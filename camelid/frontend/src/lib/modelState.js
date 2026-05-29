export function isExternalModel(model) {
  return model?.provider_kind === 'external'
}

export function hasLocalModelPath(model) {
  return Boolean(model?.model_path || model?.path)
}

export function isHostedRoutingAvailable(model) {
  return Boolean(model?.hosted_routing_ready && model?.api_base && model?.runtime_model_name && model?.api_key_configured)
}

export function isModelLoadedNow(model) {
  return Boolean(model?.loaded_now || model?.camelid?.loaded_now || model?.camelid?.active)
}

export function isModelGenerationReady(model) {
  return Boolean(model?.generation_ready || model?.camelid?.generation_ready)
}

export function isRunnableModel(model) {
  if (!model || model.status !== 'ready') return false
  if (isExternalModel(model)) return isHostedRoutingAvailable(model)
  return Boolean(hasLocalModelPath(model) && isModelLoadedNow(model) && isModelGenerationReady(model))
}

export function modelRuntimeIdMatches(model, runtime) {
  const activeModelId = runtime?.active_model_id
  if (!model || !activeModelId) return false
  return activeModelId === model.id || activeModelId === model.runtime_model_name
}

export function getRuntimeRequestModelId(model, runtime, fallback = '') {
  if (modelRuntimeIdMatches(model, runtime) && runtime?.active_model_id) return runtime.active_model_id
  return model?.runtime_model_name || model?.id || fallback || runtime?.active_model_id || ''
}

export function isRunnableInCurrentRuntime(model, runtime) {
  if (!isRunnableModel(model)) return false
  if (isExternalModel(model)) return Boolean(runtime?.generation_ready)
  return Boolean(runtime?.generation_ready && modelRuntimeIdMatches(model, runtime))
}

export function canLoadIntoRuntime(model) {
  return Boolean(model && !isExternalModel(model) && (model.status === 'ready' || model.status === 'registered' || model.status === 'failed') && hasLocalModelPath(model))
}

export function getModelStatusLabel(model) {
  if (!model) return 'No model selected'
  if (isModelLoadedNow(model) && isModelGenerationReady(model)) return 'Loaded + generation-ready'
  if (isModelLoadedNow(model)) return 'Loaded, not generation-ready'
  if (model.load_error || model.install_error) return 'Load needs attention'
  if (model.status === 'downloading') return 'Downloading'
  if (model.status === 'canceling') return 'Canceling download'
  if (model.status === 'failed') return 'Needs attention'
  if (isExternalModel(model) && model.status === 'ready') return isHostedRoutingAvailable(model) ? 'API routing ready' : 'API routing planned'
  if (model.status === 'registered') return hasLocalModelPath(model) ? 'Local path saved' : 'Imported, file path needed'
  if (model.status === 'ready' && hasLocalModelPath(model)) return 'Loadable locally'
  if (model.status === 'ready') return 'Catalog entry needs file path'
  return 'Not downloaded yet'
}

export function describeModelState(model) {
  if (!model) return 'Choose a model to decide what you want to use for the next chat.'
  if (isModelLoadedNow(model) && isModelGenerationReady(model)) return 'Loaded now and Camelid reports generation_ready=true, so chat can run immediately.'
  if (isModelLoadedNow(model)) return 'Loaded now, but Camelid still reports generation_ready=false. Chat remains blocked until tokenizer, config, tensor binding, and the CPU weight materialization budget all line up.'
  if (model.load_error || model.install_error) return 'The last load attempt failed. Check the saved path or retry after fixing the local GGUF file.'
  if (model.status === 'downloading') return 'This model is still downloading to local storage, so it cannot be used yet.'
  if (model.status === 'canceling') return 'Camelid is stopping the download and cleaning up the partial file.'
  if (model.status === 'failed') return isExternalModel(model) ? 'This API link needs attention before future hosted-provider support can use it.' : 'The last local setup attempt did not finish. Retry after checking the file path.'
  if (isExternalModel(model) && model.status === 'ready') return isHostedRoutingAvailable(model) ? 'Hosted-provider routing is available for this API-backed model.' : 'API details can be recorded later, but hosted-provider chat routing is not wired yet.'
  if (model.status === 'registered') return hasLocalModelPath(model) ? 'The local file path is saved. Use Load now to ask Camelid to load it and report generation readiness.' : 'The file is listed locally, but Camelid needs a local GGUF path before it can load it.'
  if (model.status === 'ready' && hasLocalModelPath(model)) return 'Camelid has accepted this local GGUF before. Load it into the runtime before chat can use it.'
  if (model.status === 'ready') return 'This entry exists in the catalog, but it still needs a local model file before it can run here.'
  return 'This model is listed in the catalog, but it is not downloaded locally yet.'
}
