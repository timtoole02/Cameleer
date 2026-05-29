use std::{path::PathBuf, sync::Arc};

use camelid::{
    gguf::read_metadata,
    inference::{LlamaInferenceSession, LlamaLayerDiagnostics, LlamaLoadedWeights},
    model::{LlamaModelConfig, LlamaTensorBinding},
    tensor::TensorStore,
};
use serde::Serialize;

const DEFAULT_TRACKED_TOKEN_IDS: &[usize] = &[29907, 315, 16301];
const TOP_LOGIT_LIMIT: usize = 20;

#[derive(Serialize)]
struct LogitEntry {
    token_id: usize,
    rank: usize,
    logit: f32,
}

#[derive(Serialize)]
struct Out {
    tokens: Vec<u32>,
    captured_position: usize,
    captured_layer: usize,
    layer: LlamaLayerDiagnostics,
    top_logits: Vec<LogitEntry>,
    tracked_logits: Vec<LogitEntry>,
}

fn parse_tokens(value: &str) -> Vec<u32> {
    value
        .split(',')
        .filter_map(|part| part.trim().parse::<u32>().ok())
        .collect()
}

fn parse_tracked_token_ids(value: &str) -> Vec<usize> {
    value
        .split(',')
        .filter_map(|part| part.trim().parse::<usize>().ok())
        .collect()
}

fn ranked_logits(logits: &[f32]) -> Vec<usize> {
    let mut indices = (0..logits.len()).collect::<Vec<_>>();
    indices.sort_by(|left, right| {
        logits[*right]
            .partial_cmp(&logits[*left])
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    indices
}

fn logit_entry(token_id: usize, rank_by_token: &[usize], logits: &[f32]) -> Option<LogitEntry> {
    logits.get(token_id).map(|logit| LogitEntry {
        token_id,
        rank: rank_by_token[token_id],
        logit: *logit,
    })
}

fn main() -> anyhow::Result<()> {
    let model = std::env::args()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("models/tinyllama-1.1b-chat-v1.0.Q8_0.gguf"));
    let tokens = std::env::args()
        .nth(2)
        .map(|value| parse_tokens(&value))
        .filter(|tokens| !tokens.is_empty())
        .unwrap_or_else(|| vec![1]);
    let layer_index = std::env::args()
        .nth(3)
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(0);
    let tracked_token_ids = std::env::args()
        .nth(4)
        .map(|value| parse_tracked_token_ids(&value))
        .filter(|tokens| !tokens.is_empty())
        .unwrap_or_else(|| DEFAULT_TRACKED_TOKEN_IDS.to_vec());

    let gguf = read_metadata(&model)?;
    let config = LlamaModelConfig::from_gguf(&gguf)?;
    let binding = LlamaTensorBinding::bind(&gguf, &config)?;
    let store = TensorStore::open(&model, &gguf);
    let weights = Arc::new(LlamaLoadedWeights::load(&store, &binding)?);
    weights.validate_dense_shapes(&config)?;
    let mut session = LlamaInferenceSession::new(config, weights)?;
    let mut layer = None;
    let mut logits = None;
    for token in &tokens {
        let step = session.forward_single_token_timed(*token)?;
        logits = Some(step.output.logits);
        layer = Some(
            step.diagnostics
                .layers
                .into_iter()
                .find(|layer| layer.layer_index == layer_index),
        );
    }
    let layer = layer.flatten().ok_or_else(|| {
        anyhow::anyhow!("captured forward pass did not include layer {layer_index}")
    })?;
    let logits = logits.expect("at least one token");
    let ranked = ranked_logits(&logits.data);
    let mut rank_by_token = vec![0; logits.data.len()];
    for (rank_index, token_id) in ranked.iter().copied().enumerate() {
        rank_by_token[token_id] = rank_index + 1;
    }
    let top_logits = ranked
        .iter()
        .copied()
        .take(TOP_LOGIT_LIMIT)
        .filter_map(|token_id| logit_entry(token_id, &rank_by_token, &logits.data))
        .collect::<Vec<_>>();
    let tracked_logits = tracked_token_ids
        .iter()
        .copied()
        .filter_map(|token_id| logit_entry(token_id, &rank_by_token, &logits.data))
        .collect::<Vec<_>>();
    let out = Out {
        captured_position: tokens.len() - 1,
        captured_layer: layer_index,
        tokens,
        layer,
        top_logits,
        tracked_logits,
    };
    println!("{}", serde_json::to_string_pretty(&out)?);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_comma_separated_tokens() {
        assert_eq!(parse_tokens("1, 2,17"), vec![1, 2, 17]);
        assert_eq!(parse_tokens("not-a-token"), Vec::<u32>::new());
    }

    #[test]
    fn ranks_logits_and_tracks_requested_tokens() {
        let logits = vec![0.25, 2.0, -1.0, 0.5];
        let ranked = ranked_logits(&logits);
        let mut rank_by_token = vec![0; logits.len()];
        for (rank_index, token_id) in ranked.iter().copied().enumerate() {
            rank_by_token[token_id] = rank_index + 1;
        }

        assert_eq!(ranked, vec![1, 3, 0, 2]);
        let tracked = logit_entry(3, &rank_by_token, &logits).unwrap();
        assert_eq!(tracked.token_id, 3);
        assert_eq!(tracked.rank, 2);
        assert_eq!(tracked.logit, 0.5);
        assert!(logit_entry(99, &rank_by_token, &logits).is_none());
    }
}
