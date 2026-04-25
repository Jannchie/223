import { useLocalStorage } from '@vueuse/core'
import { ref } from 'vue'

export interface UpdateGazeParams {
  model: any | null
  canvasX: number
  canvasY: number
  canvasScale: number
  canvasWidth?: number
  canvasHeight?: number
  mouseX: number
  mouseY: number
  isInputFocused: boolean
  isGazingAtUser: boolean
}

export interface GazeAtUserConfig {
  enabled: boolean
  intervalMinutes: number
  lockDurationSeconds: number
  randomizeInterval: boolean
  randomizeDuration: boolean
  randomOffset: boolean
}

export type GazeAtUserConfigUpdate = Partial<GazeAtUserConfig>

export function useGaze() {
  // Public state
  const gazeTargetX = ref<number | null>(null)
  const gazeTargetY = ref<number | null>(null)

  const gazeAtUserConfig = useLocalStorage<GazeAtUserConfig>('gaze-at-user-config', {
    enabled: true,
    intervalMinutes: 1,
    lockDurationSeconds: 3,
    randomizeInterval: true,
    randomizeDuration: true,
    randomOffset: true,
  })
  const isGazingAtUser = ref(false)

  // Internals
  const gazeAtUserTimer = ref<NodeJS.Timeout | null>(null)
  const lastTargetX = ref(0)
  const lastTargetY = ref(0)
  const lastGazeSourceType = ref('')

  function setGazeTarget(x: number, y: number) {
    gazeTargetX.value = x
    gazeTargetY.value = y
  }

  function clearGazeTarget() {
    gazeTargetX.value = null
    gazeTargetY.value = null
  }

  function getRandomizedInterval(): number {
    const baseIntervalMs = gazeAtUserConfig.value.intervalMinutes * 60 * 1000
    if (!gazeAtUserConfig.value.randomizeInterval) {
      return baseIntervalMs
    }
    const randomFactor = 0.5 + Math.random() * 1
    return Math.round(baseIntervalMs * randomFactor)
  }

  function getRandomizedDuration(): number {
    const baseDurationMs = gazeAtUserConfig.value.lockDurationSeconds * 1000
    if (!gazeAtUserConfig.value.randomizeDuration) {
      return baseDurationMs
    }
    const randomFactor = 0.7 + Math.random() * 0.6
    return Math.round(baseDurationMs * randomFactor)
  }

  function startGazeAtUser(model: any | null) {
    if (!gazeAtUserConfig.value.enabled || isGazingAtUser.value || !model) {
      return
    }
    try {
      const modelWithEyesLock = model as any
      if (modelWithEyesLock.setEyesAlwaysLookAtCamera) {
        isGazingAtUser.value = true
        modelWithEyesLock.setEyesAlwaysLookAtCamera(true)
        const lockDuration = getRandomizedDuration()
        setTimeout(() => {
          stopGazeAtUser(model)
        }, lockDuration)
      }
      else {
        // Model does not support eye lock; ignore gracefully
      }
    }
    catch {
      isGazingAtUser.value = false
    }
  }

  function stopGazeAtUser(model: any | null) {
    if (!isGazingAtUser.value || !model) {
      return
    }
    try {
      const m = model as any
      if (m.setEyesAlwaysLookAtCamera && m.isEyesAlwaysLookAtCamera && m.isEyesAlwaysLookAtCamera()) {
        m.setEyesAlwaysLookAtCamera(false)
      }
      isGazingAtUser.value = false
    }
    catch {
      isGazingAtUser.value = false
    }
  }

  function startGazeAtUserTimer(isBusy: () => boolean, getModel: () => any | null) {
    if (!gazeAtUserConfig.value.enabled) {
      return
    }
    stopGazeAtUserTimer()
    const scheduleNext = () => {
      if (!gazeAtUserConfig.value.enabled) {
        return
      }
      const intervalMs = getRandomizedInterval()
      gazeAtUserTimer.value = setTimeout(() => {
        if (!isBusy()) {
          startGazeAtUser(getModel())
        }
        scheduleNext()
      }, intervalMs)
    }
    scheduleNext()
  }

  function stopGazeAtUserTimer() {
    if (gazeAtUserTimer.value) {
      clearTimeout(gazeAtUserTimer.value)
      gazeAtUserTimer.value = null
    }
    // Also stop current lock just in case
    // Caller should pass current model when wanting to force stop
  }

  function updateGazeAtUserConfig(newConfig: GazeAtUserConfigUpdate) {
    gazeAtUserConfig.value = { ...gazeAtUserConfig.value, ...newConfig }
  }

  // Main tracking update; call from ticker
  function updateGazeParameters(params: UpdateGazeParams) {
    const { model, canvasX, canvasY, canvasScale, canvasWidth, canvasHeight, mouseX, mouseY, isInputFocused, isGazingAtUser } = params
    if (!model) {
      return
    }
    if (isGazingAtUser) {
      return
    }

    let targetScreenX = 0
    let targetScreenY = 0
    let sourceType = ''

    if (gazeTargetX.value !== null && gazeTargetY.value !== null) {
      targetScreenX = gazeTargetX.value
      targetScreenY = gazeTargetY.value
      sourceType = isInputFocused ? '光标' : 'Electron鼠标'
    }
    else {
      targetScreenX = mouseX
      targetScreenY = mouseY
      sourceType = '本地鼠标'
    }

    const threshold = 2
    const hasChanged = (
      Math.abs(targetScreenX - lastTargetX.value) > threshold
      || Math.abs(targetScreenY - lastTargetY.value) > threshold
      || sourceType !== lastGazeSourceType.value
    )
    if (!hasChanged) {
      return
    }

    let eyeScreenX = canvasX + ((canvasWidth ?? 800) * canvasScale) / 2
    let eyeScreenY = canvasY + ((canvasHeight ?? 1200) * canvasScale) * 0.35
    try {
      const internalModel = (model as any).internalModel as any
      if (internalModel?.coreModel?.getDrawableCount) {
        const drawableCount = internalModel.coreModel.getDrawableCount()
        for (let i = 0; i < drawableCount; i++) {
          try {
            const drawableId = internalModel.coreModel.getDrawableId(i)
            if (drawableId && (drawableId.includes('Eye') || drawableId.includes('eye') || drawableId.includes('目'))
              && internalModel.coreModel.getDrawableVertexPositions) {
              const vertices = internalModel.coreModel.getDrawableVertexPositions(i)
              if (vertices && vertices.length >= 2) {
                let centerX = 0
                let centerY = 0
                const vertexCount = vertices.length / 2
                for (let j = 0; j < vertices.length; j += 2) {
                  centerX += vertices[j]
                  centerY += vertices[j + 1]
                }
                centerX /= vertexCount
                centerY /= vertexCount
                const worldPos = (model as any).toGlobal({ x: centerX, y: centerY })
                eyeScreenX = worldPos.x
                eyeScreenY = worldPos.y
                break
              }
            }
          }
          catch {
            // continue
          }
        }
      }
    }
    catch {
      // fallback will be used
    }

    const directionX = targetScreenX - eyeScreenX
    const directionY = targetScreenY - eyeScreenY
    const directionLength = Math.hypot(directionX, directionY)
    if (directionLength === 0) {
      return
    }
    const normalizedX = directionX / directionLength
    const normalizedY = directionY / directionLength
    const projectionDistance = 10_000
    const projectionScreenX = eyeScreenX + normalizedX * projectionDistance
    const projectionScreenY = eyeScreenY + normalizedY * projectionDistance
    const projectionCanvasX = projectionScreenX - canvasX
    const projectionCanvasY = projectionScreenY - canvasY
    const modelX = projectionCanvasX / canvasScale
    const modelY = projectionCanvasY / canvasScale
    const instant = false
    ;(model as any).focus(modelX, modelY, instant)

    lastTargetX.value = targetScreenX
    lastTargetY.value = targetScreenY
    lastGazeSourceType.value = sourceType
  }

  return {
    // state
    gazeTargetX,
    gazeTargetY,
    gazeAtUserConfig,
    isGazingAtUser,
    // actions
    setGazeTarget,
    clearGazeTarget,
    startGazeAtUser,
    stopGazeAtUser,
    startGazeAtUserTimer,
    stopGazeAtUserTimer,
    updateGazeAtUserConfig,
    updateGazeParameters,
  }
}
