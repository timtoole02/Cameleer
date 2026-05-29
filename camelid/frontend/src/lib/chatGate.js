import { compatibilityHintCopy, compatibilityHintLabel, findCompatibilityHint, isCompatibilitySupportedForModel } from './capabilities.js'
import { isRunnableInCurrentRuntime, modelRuntimeIdMatches } from './modelState.js'

export function getChatGateState(capabilities, model, runtime) {
  const runtimeLoaded = Boolean(runtime?.loaded_now && modelRuntimeIdMatches(model, runtime))
  const runtimeGenerationReady = Boolean(runtime?.generation_ready && modelRuntimeIdMatches(model, runtime))
  const runtimeReady = Boolean(isRunnableInCurrentRuntime(model, runtime) && runtimeLoaded && runtimeGenerationReady)
  const hint = findCompatibilityHint(capabilities, model)
  const contractSupported = isCompatibilitySupportedForModel(capabilities, model)
  const chatUnlocked = Boolean(runtimeReady && contractSupported)
  const chatMode = contractSupported ? 'supported' : 'blocked'

  return {
    hint,
    runtimeReady,
    runtimeLoaded,
    runtimeGenerationReady,
    contractSupported,
    chatUnlocked,
    chatMode,
    label: compatibilityHintLabel(hint, 'No matching COMPATIBILITY.md row'),
    copy: compatibilityHintCopy(hint),
  }
}
