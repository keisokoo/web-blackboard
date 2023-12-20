import { LocalTrackPublication, RoomEvent, RemoteParticipant, RemoteTrack, RemoteTrackPublication, Room, createLocalAudioTrack, Participant, ParticipantEvent, Track, DataPacket_Kind } from 'livekit-client';
import WebBlackBoard from '../WebBlackBoard';
import Konva from 'konva';

const decoder = new TextDecoder();
class LiveDrawing {
  // TODO: 개설자, 참여자 구분 필요, 참여자는 최초에 캔버스를 그릴 수 없고 마이크도 꺼져있어야 함. 개설자는 마이크가 켜져있어야 함 캔버스를 그릴 수 있어야 함.
  // TODO: 개설자가 참여자에게 캔버스를 그릴 수 있도록 권한을 줄 수 있어야 함. 권한은 한명에게만 줄 수 있음.
  // TODO: 참여자는 참여시 참여전 작성된 캔버스를 볼 수 있어야 하며, 참여자의 화면을 중심으로 띄워야 함.
  // TODO: 디바이스 크기가 각기 다르므로, 캔버스의 크기를 디바이스 크기에 맞게 조절하거나 스크롤을 통해 볼 수 있어야 함.
  // TODO: 문제 이미지를 변경할 수 있어야 함. 문제 이미지는 개설자만 변경할 수 있어야 함. 변경시 레이어 가장 위에 띄워야 함.
  // 일많네...
  private wsURL: string = '';
  private wsToken: string = '';
  room: Room;
  participant: Map<string, RemoteParticipant> = new Map();
  publishTrack: LocalTrackPublication | null = null;
  audioElement: HTMLAudioElement | null = null;
  webBlackBoard: WebBlackBoard;
  remoteLine: Konva.Line | null = null;
  cb: (data: string) => void = () => { };
  constructor(webBlackBoard: WebBlackBoard) {
    this.webBlackBoard = webBlackBoard;
    this.room = new Room({
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      publishDefaults: {
        audioPreset: {
          maxBitrate: 16000,
        }
      }
    });
  }
  setURL(url: string) {
    this.wsURL = url;
  }
  setToken(token: string) {
    this.wsToken = token;
  }
  setCallback(cb: (data: string) => void) {
    this.cb = cb;
  }
  init(audioElement: HTMLAudioElement, url: string, token: string) {
    this.audioElement = audioElement;
    this.setURL(url);
    this.setToken(token);
  }
  remoteDrawing(data: string) {
    if (!this.webBlackBoard) return
    const parsed = JSON.parse(data)
    console.log('parsed', parsed)
    if (parsed.type === 'brush-down') {
      this.remoteLine = new Konva.Line(parsed.lineConfig)
      this.webBlackBoard.layer.add(this.remoteLine)
    }
    if (parsed.type === 'brush-move') {
      if (!this.remoteLine) return
      let newPoints = this.remoteLine.points().concat(parsed.points)
      this.remoteLine.points(newPoints)
      this.webBlackBoard.layer.batchDraw()
    }
    if (parsed.type === 'brush-up') {
      console.log('end')
    }
  }
  handleTrackSubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) {
    console.log('track.kind', track.kind, this.audioElement)
    if (!this.audioElement) {
      this.audioElement = document.querySelector('#wb-audio')!
      console.log('audioElement is not set', this.audioElement)
    }
    if (track.kind === Track.Kind.Audio) {
      /* do things with track, publication or participant */
      console.log('track subscribed', track, publication, participant);
      track.attach(this.audioElement);
    }
  }
  setRoomEvent(currentRoom: Room) {
    currentRoom
      .on(RoomEvent.TrackSubscribed, this.handleTrackSubscribed.bind(this))
    currentRoom.on(RoomEvent.Connected, () => {
      console.log('connected to room');
    })
    currentRoom.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
      const strData = decoder.decode(payload);
      console.log('data received', strData, participant, kind, topic);
      this.cb(strData);
    });
    currentRoom.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('participant connected', participant);
      this.participant.set(participant.sid, participant);
      participant.on(ParticipantEvent.IsSpeakingChanged, (speaking: boolean) => {
        console.log(`${participant.identity} is ${speaking ? "now" : "no longer"} speaking. audio level: ${participant.audioLevel}`)
      })
    })
    currentRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('participant disconnected', participant);
      this.participant.delete(participant.sid);
    })
    currentRoom.on(RoomEvent.Disconnected, () => {
      console.log('disconnected from room');
    })
    currentRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      // speakers contain all of the current active speakers
      console.log('speakers', speakers);
    })
  }
  async publishTracks(room: Room) {
    const audioTrack = await createLocalAudioTrack({
      echoCancellation: true,
      noiseSuppression: true,
    })
    this.publishTrack = await room.localParticipant.publishTrack(audioTrack)
  }
  async connect() {
    if (!this.wsURL) {
      throw new Error('url is not set');
    }
    if (!this.audioElement) {
      throw new Error('audioElement is not set');
    }
    if (!this.wsToken) {
      throw new Error('token is not set');
    }
    await this.room.connect(this.wsURL!, this.wsToken, {
      autoSubscribe: true,
    });
    console.log('connected to room');
    await this.room.localParticipant.setMicrophoneEnabled(true);
    this.room.localParticipant.setTrackSubscriptionPermissions(true)
    console.log('enabled camera and microphone');
    this.setRoomEvent(this.room)
  }
  async disconnect() {
    await this.room.disconnect();
    console.log('disconnected from room');
  }

}
export default LiveDrawing;