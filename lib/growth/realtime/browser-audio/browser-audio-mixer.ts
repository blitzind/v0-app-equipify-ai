/** WebAudio mixer for mic + meeting tab audio — no persistence (Growth Engine slice 6.21A). */

export type BrowserAudioMixerGainControls = {
  microphoneGain: number
  meetingGain: number
}

export type BrowserAudioMixerHandle = {
  addMicrophoneSource: (stream: MediaStream) => void
  addMeetingSource: (stream: MediaStream) => void
  setMicrophoneGain: (gain: number) => void
  setMeetingGain: (gain: number) => void
  getMixedStream: () => MediaStream
  destroy: () => void
  isDestroyed: () => boolean
  getGainControls: () => BrowserAudioMixerGainControls
}

type MixerNodeRefs = {
  microphoneGainNode: GainNode | null
  meetingGainNode: GainNode | null
  microphoneSource: MediaStreamAudioSourceNode | null
  meetingSource: MediaStreamAudioSourceNode | null
}

function clampGain(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(1, Math.max(0, value))
}

function stopStreamTracks(stream: MediaStream | null): void {
  if (!stream) return
  for (const track of stream.getTracks()) {
    track.stop()
  }
}

export function createBrowserAudioMixer(): BrowserAudioMixerHandle {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") {
    throw new Error("Browser audio mixer is not available in this environment.")
  }

  const audioContext = new AudioContext()
  const destination = audioContext.createMediaStreamDestination()
  const nodes: MixerNodeRefs = {
    microphoneGainNode: null,
    meetingGainNode: null,
    microphoneSource: null,
    meetingSource: null,
  }
  const ownedStreams: MediaStream[] = []
  let destroyed = false
  let microphoneGain = 1
  let meetingGain = 1

  function assertActive(): void {
    if (destroyed) throw new Error("Browser audio mixer has been destroyed.")
  }

  function connectSource(
    stream: MediaStream,
    kind: "microphone" | "meeting",
  ): void {
    assertActive()
    ownedStreams.push(stream)
    const source = audioContext.createMediaStreamSource(stream)
    const gainNode = audioContext.createGain()
    gainNode.gain.value = kind === "microphone" ? microphoneGain : meetingGain
    source.connect(gainNode)
    gainNode.connect(destination)

    if (kind === "microphone") {
      nodes.microphoneSource?.disconnect()
      nodes.microphoneGainNode?.disconnect()
      nodes.microphoneSource = source
      nodes.microphoneGainNode = gainNode
      return
    }

    nodes.meetingSource?.disconnect()
    nodes.meetingGainNode?.disconnect()
    nodes.meetingSource = source
    nodes.meetingGainNode = gainNode
  }

  return {
    addMicrophoneSource(stream) {
      connectSource(stream, "microphone")
    },
    addMeetingSource(stream) {
      connectSource(stream, "meeting")
    },
    setMicrophoneGain(gain) {
      assertActive()
      microphoneGain = clampGain(gain)
      if (nodes.microphoneGainNode) nodes.microphoneGainNode.gain.value = microphoneGain
    },
    setMeetingGain(gain) {
      assertActive()
      meetingGain = clampGain(gain)
      if (nodes.meetingGainNode) nodes.meetingGainNode.gain.value = meetingGain
    },
    getMixedStream() {
      assertActive()
      return destination.stream
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      nodes.microphoneSource?.disconnect()
      nodes.meetingGainNode?.disconnect()
      nodes.meetingSource?.disconnect()
      nodes.microphoneGainNode?.disconnect()
      nodes.microphoneSource = null
      nodes.meetingGainNode = null
      nodes.meetingSource = null
      nodes.meetingGainNode = null
      for (const stream of ownedStreams) {
        stopStreamTracks(stream)
      }
      ownedStreams.length = 0
      void audioContext.close().catch(() => undefined)
    },
    isDestroyed() {
      return destroyed
    },
    getGainControls() {
      return { microphoneGain, meetingGain }
    },
  }
}

export function extractAudioOnlyStream(displayStream: MediaStream): MediaStream | null {
  const audioTracks = displayStream.getAudioTracks()
  if (audioTracks.length === 0) return null
  for (const track of displayStream.getVideoTracks()) {
    track.stop()
  }
  return new MediaStream(audioTracks)
}
