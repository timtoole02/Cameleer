export interface ProviderConfig {
    id?: number;
    provider: string;
    model_name: string;
    api_key: string | null;
    endpoint_url: string | null;
    is_default: boolean;
}

export interface ModelCatalogEntry {
    model_id: string;
    display_name: string;
    provider: string;
    source_repo: string | null;
    source_file: string | null;
    local_path: string | null;
    architecture: string | null;
    quantization: string | null;
    parameter_count: string | null;
    file_size_bytes: number;
    install_status: string;
    compatibility_status: string;
    runnable_status: boolean;
    active_status: boolean;
    license: string | null;
}

export interface HuggingFaceModelEntry {
    repo_id: string;
    filename: string;
    size_bytes: number;
    download_url: string;
}

export interface PreflightResponse {
    file_valid: boolean;
    gguf_version: number;
    architecture: string;
    tensor_count: number;
    metadata_count: number;
    context_length: number;
    quantization: string;
    compatibility_tier: string;
    tensor_paths_supported: boolean;
    tokenizer_supported: boolean;
    estimated_memory_required: string;
    recommended_action: string;
    warnings: string[];
    blockers: string[];
}

export interface TensorDetails {
    tensor_name: string;
    tensor_type: string;
    shape: number[];
    supported: boolean;
    notes: string | null;
}

export interface DownloadDetails {
    download_id: string;
    status: string;
    total_bytes: number;
    downloaded_bytes: number;
    resume_supported: boolean;
    started_at: string;
    completed_at: string | null;
    error_message: string | null;
}

export interface ActivationDetails {
    scope_type: string;
    scope_id: string;
    activated_at: string;
}

export interface InspectionDetails {
    gguf_version: number;
    architecture: string;
    tokenizer_model: string;
    context_length: number;
    embedding_length: number;
    block_count: number;
    feed_forward_length: number;
    attention_head_count: number;
    attention_head_count_kv: number;
    rope_dimension_count: number;
    rope_freq_base: number;
    rope_freq_scale: number;
    quantization_summary: string;
    tensor_count: number;
    supported_tensor_types: string[];
    unsupported_tensor_types: string[];
    required_runtime_features: string[];
    inspection_status: string;
    inspection_errors: string | null;
}

export interface ModelDetailsResponse {
    entry: ModelCatalogEntry;
    inspection: InspectionDetails | null;
    tensors: TensorDetails[];
    download: DownloadDetails | null;
    activations: ActivationDetails[];
}

export interface StorageUsageResponse {
    total_allocated_bytes: number;
    space_saved_partial_bytes: number;
    installed_count: number;
    models_storage_path: string;
}

export interface SmokeTestResult {
    success: boolean;
    prompt: string;
    tokens_generated: number;
    tokens_per_second: number;
    load_latency_ms: number;
    memory_allocated_mb: number;
    log_output: string;
}
