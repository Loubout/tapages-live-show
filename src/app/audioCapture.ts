
export class AudioCapture {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private scriptNode: ScriptProcessorNode | null = null;

  private resolveBufferPromise: ((buffer: AudioBuffer) => void) | null = null;
  private bufferPromise: Promise<AudioBuffer> | null = null;
  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log(this.audioContext.destination)
      // Create nodes
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.destinationNode = this.audioContext.createMediaStreamDestination();
      this.scriptNode = this.audioContext.createScriptProcessor(2048, 1, 1);

      // Connect nodes
      this.sourceNode.connect(this.destinationNode);
      if (this.destinationNode) {
        // Déconnectez d'abord pour éviter des erreurs de connexion multiples
        this.destinationNode.disconnect();
        // Connectez ensuite au contexte audio de destination
        this.destinationNode.connect(this.audioContext.destination);
      }

      // Create buffer
      const bufferSize = 2048;
      this.audioBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);

      // Connect scriptNode to process audio data
      if (this.scriptNode) {
        this.scriptNode.onaudioprocess = (e: AudioProcessingEvent) => {
          const inputBuffer = e.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);

          // Copy audio data to the buffer
          if (this.audioBuffer) {
            this.audioBuffer.getChannelData(0).set(inputData);
          }
        };

        this.destinationNode.connect(this.scriptNode);
        this.scriptNode.connect(this.audioContext.destination);

        // Stop recording after a few seconds (you can adjust this)
        setTimeout(() => {
          if (this.destinationNode?.stream) {
            this.destinationNode.stream.getAudioTracks()[0].stop();
            console.log('Recording ended');
          }
        }, 5000); // Stop recording after 5 seconds (example)
      }
    } catch (error) {
      console.error('Error accessing the microphone: ', error);
    }
  }
  public async getAudioBuffer(): Promise<AudioBuffer> {
    if (!this.audioBuffer) {
      // Si l'objet AudioBuffer n'est pas encore prêt, utilisez une promesse
      if (!this.bufferPromise) {
        this.bufferPromise = new Promise<AudioBuffer>((resolve) => {
          this.resolveBufferPromise = resolve;
        });
      }
      // Attendre que la promesse soit résolue lorsque l'objet AudioBuffer est prêt
      await this.bufferPromise;
    }
    // Retourner l'objet AudioBuffer
    return this.audioBuffer as AudioBuffer;
  }

  // ...

  private onRecordingEnded() {
    console.log('Recording ended');
    // Résoudre la promesse et fournir l'objet AudioBuffer
    if (this.resolveBufferPromise) {
      this.resolveBufferPromise(this.audioBuffer as AudioBuffer);
    }
  }
}
