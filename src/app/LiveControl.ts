import { Room, RemoteParticipant, LocalTrackPublication, createLocalAudioTrack, Participant, ParticipantEvent, RemoteTrack, RemoteTrackPublication, RoomEvent, Track, DataPacket_Kind } from "livekit-client";
import Blackboard from "./Blackboard";
import { UserType, AccessType } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type WithoutAccessType = Omit<UserType, 'access'>

class LiveControl {
  private wsURL: string = '';
  private wsToken: string = '';
  room: Room;
  participant: Map<string, RemoteParticipant> = new Map();
  publishTrack: LocalTrackPublication | null = null;
  audioElement: HTMLAudioElement | null = null;
  
  userList: Map<string, UserType> = new Map();
  blackboard: Blackboard;
  publishData: (data: string) => void = () => { };
  receiveData: (data: string) => void = () => { };
  constructor(blackboard: Blackboard, user: WithoutAccessType) {
    this.blackboard = blackboard;
    this.addUser(user)
    this.room = new Room({
      adaptiveStream: true,
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
    this.setRoomEvent(this.room)
  }
  setURL(url: string) {
    this.wsURL = url;
  }
  setToken(token: string) {
    this.wsToken = token;
  }
  setPublishCallback(cb: (data: string) => void) {
    this.publishData = cb;
  }
  setReceiveCallback(cb: (data: string) => void) {
    this.receiveData = cb;
  }
  init(audioElement: HTMLAudioElement, url: string, token: string) {
    this.audioElement = audioElement;
    this.setURL(url);
    this.setToken(token);
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
      participant.tracks.forEach(trackPublication => {
        if (trackPublication.track && this.audioElement) {
          console.log('participant.tracks attach')
          trackPublication.track.attach(this.audioElement);
        }
      });
      publication.track?.attach(this.audioElement);
      track.attach(this.audioElement);
      this.room.startAudio();
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
      this.receiveData(strData);
    });
    currentRoom.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('participant connected', participant);
      this.participant.set(participant.sid, participant);
      participant.on(ParticipantEvent.IsSpeakingChanged, (speaking: boolean) => {
        console.log(`${participant.identity} is ${speaking ? "now" : "no longer"} speaking. audio level: ${participant.audioLevel}`)
      })
      const data = {
        target: participant.sid,
        type: 'init',
        stacks: this.blackboard.stackManager.getStacks(),
        image: this.blackboard.background?.id()
      }
      const strData = encoder.encode(JSON.stringify(data));
      currentRoom.localParticipant?.publishData(strData, DataPacket_Kind.LOSSY);
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
    await this.room.localParticipant.setMicrophoneEnabled(true);
    this.room.localParticipant.setTrackSubscriptionPermissions(true)
    console.log('enabled camera and microphone');
  }
  async disconnect() {
    await this.room.disconnect();
    console.log('disconnected from room');
  }
  addUser(user: WithoutAccessType) {
    this.userList.set(user.userId, {
      ...user,
      access: {
        mic: user.role === 'publisher',
        draw: user.role === 'publisher'
      }
    });
  }
  getCurrentUserBy(userId: string) {
    return this.userList.get(userId);
  }
  setAccess(userId: string, access: AccessType) {
    const user = this.userList.get(userId);
    if (!user) return;
    user.access = access;
  }
}
export default LiveControl;