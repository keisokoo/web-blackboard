import { Room, RemoteParticipant, LocalTrackPublication, createLocalAudioTrack, Participant, ParticipantEvent, RemoteTrack, RemoteTrackPublication, RoomEvent, Track, DataPacket_Kind } from "livekit-client";
import Blackboard from "./Blackboard";
import { UserType, AccessType, BlackboardUserType, LiveControlUserType, StackType, RoleType, RecordDataType, EgressInfo } from "./types";
import WBLine from "./WBLine";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
class LiveControl {
  isRecording: boolean = false;
  egressInfo: EgressInfo | null = null;
  private wsURL: string = '';
  private wsToken: string = '';
  room: Room;
  publishTrack: LocalTrackPublication | null = null;
  audioElement: HTMLAudioElement | null = null;

  recordData: RecordDataType | null = null;

  blackboard: Blackboard;

  recording?: {
    start: (roomName: string) => Promise<EgressInfo | null>,
    stop: (egressId: string) => Promise<EgressInfo | null>,
  }
  constructor(blackboard: Blackboard) {
    this.blackboard = blackboard;
    this.addUser(this.blackboard.user)
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
  setRecording(recording: {
    start: (roomName: string) => Promise<EgressInfo | null>,
    stop: (egressId: string) => Promise<EgressInfo | null>,
  }) {
    this.recording = recording;
  }
  setURL(url: string) {
    this.wsURL = url;
  }
  setToken(token: string) {
    this.wsToken = token;
  }
  publishData(data: string) {
    if (this.room.state !== 'connected') return
    if (this.room.participants.size === 0) return
    const strData = encoder.encode(data);
    this.room.localParticipant?.publishData(strData, DataPacket_Kind.LOSSY);
  }
  receiveData(data: string) {
    const decoded = JSON.parse(data);
    if (!decoded) return
    console.log('decoded', decoded)
    if (decoded.target && decoded.target === this.blackboard.user.id && decoded.type) {
      if (decoded.type === 'init') {
        const stacks = decoded.stacks;
        const imageUrl = decoded.image;
        this.blackboard.stackManager.initStacks(stacks);
        this.blackboard.setBackground(imageUrl, true);
      }
      if (decoded.type === 'mute') {
        this.room.localParticipant?.audioTracks.forEach((track) => {
          track.mute();
        })
      }
      if (decoded.type === 'unmute') {
        this.room.localParticipant?.audioTracks.forEach((track) => {
          track.unmute();
        })
      }
      if (decoded.type === 'draw-on') {
        this.blackboard.userList.set(decoded.target, {
          ...this.blackboard.userList.get(decoded.target)!,
          access: {
            ...this.blackboard.userList.get(decoded.target)?.access!,
            draw: true
          }
        })
        this.blackboard.updated('draw-on')
      }
      if (decoded.type === 'draw-off') {
        this.blackboard.userList.set(decoded.target, {
          ...this.blackboard.userList.get(decoded.target)!,
          access: {
            ...this.blackboard.userList.get(decoded.target)?.access!,
            draw: false
          }
        })
        this.blackboard.updated('draw-off')
      }
    } else {
      if (decoded.type && decoded.type.includes('remote-')) {
        if (decoded.type === 'remote-down') {
          const wb = new WBLine({
            userType: 'remote',
            userId: decoded.userId,
            lineConfig: decoded.lineConfig,
            deleteAble: false
          })
          this.blackboard.setNewLine(wb);
          this.blackboard.handlers.bindHitLineEvent(wb);
        } else if (decoded.type && decoded.type === 'remote-move') {
          const wb = this.blackboard.getLastLine(decoded.userId);
          if (!wb) return
          const newPoints = wb.line.points().concat(decoded.nextPoints);
          wb.line.points(newPoints);
          this.blackboard.layer.batchDraw();
        }
      } else {
        const stack = decoded as StackType;
        this.blackboard.stackManager.runStack(stack);
        this.blackboard.stackManager.addStack(stack, false, false);
      }
    }
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
    if (!this.audioElement) {
      this.audioElement = document.querySelector('#wb-audio')!
    }
    if (track.kind === Track.Kind.Audio) {
      participant.tracks.forEach(trackPublication => {
        if (trackPublication.track && this.audioElement) {
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
    currentRoom.on(RoomEvent.Connected, async () => {
      console.log('connected to room');
      currentRoom.participants.forEach((participant) => {
        console.log('participant', participant)
      })
      if (this.blackboard.user.role === 'presenter' && !this.isRecording) {
        if (this.recording?.start) {
          const recordingData = await this.recording.start(currentRoom.name)
          this.egressInfo = recordingData
        }
      }
    })
    currentRoom.on(RoomEvent.TrackMuted, (track, participant) => {
      this.blackboard.userList.set(participant.identity, {
        ...this.blackboard.userList.get(participant.identity)!,
        access: {
          ...this.blackboard.userList.get(participant.identity)?.access!,
          mic: false
        }
      })
      this.blackboard.updated('mute')
    })
    currentRoom.on(RoomEvent.TrackUnmuted, (track, participant) => {
      this.blackboard.userList.set(participant.identity, {
        ...this.blackboard.userList.get(participant.identity)!,
        access: {
          ...this.blackboard.userList.get(participant.identity)?.access!,
          mic: true
        }
      })
      this.blackboard.updated('unmute')
    })
    currentRoom.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
      const strData = decoder.decode(payload);
      this.receiveData(strData);
    });
    currentRoom.on(RoomEvent.ParticipantConnected, (participant) => {
      participant.on(ParticipantEvent.IsSpeakingChanged, (speaking: boolean) => {
        console.log(`${participant.identity} is ${speaking ? "now" : "no longer"} speaking. audio level: ${participant.audioLevel}`)
      })
      const role = participant.metadata as RoleType
      this.addUser({
        id: participant.identity,
        role: role ?? 'audience',
        nickname: participant.identity,
      }, participant)
      const data = {
        target: participant.identity,
        type: 'init',
        stacks: this.blackboard.stackManager.getStacks(),
        image: this.blackboard.background?.id()
      }
      const strData = encoder.encode(JSON.stringify(data));
      currentRoom.localParticipant?.publishData(strData, DataPacket_Kind.LOSSY, [participant.sid]);
    })
    currentRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
      const presenter = this.blackboard.userList.get(participant.identity)
      this.removeUser(participant.identity)
      if (presenter?.role === 'presenter') {
        this.disconnect()
      }
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
    this.room.participants.forEach((participant) => {
      this.addUser({
        id: participant.identity,
        role: participant.metadata as RoleType ?? 'audience',
        nickname: participant.identity,
      }, participant)
    })
    const localParticipant = await this.room.localParticipant.setMicrophoneEnabled(true);
    if (this.blackboard.user.role !== 'presenter') localParticipant?.mute()
    this.room.localParticipant.setTrackSubscriptionPermissions(true)
  }
  groupingPlayingData(egressInfo: EgressInfo | null, stacks: StackType[]): RecordDataType | null {
    if (!egressInfo) return null
    const fileResult = egressInfo.fileResults?.[0]
    const startTime = fileResult?.startedAt ?? egressInfo.startedAt
    const endTime = fileResult?.endedAt
    const duration = fileResult?.duration
    return {
      filename: fileResult?.filename ?? '',
      firstImage: this.blackboard.firstBackgroundImage,
      audioInfo: {
        startTime: startTime ?? 0,
        endTime: endTime ?? 0,
        duration: duration ?? 0,
        historyStack: stacks
      }
    }
  }
  async disconnect() {
    if (this.blackboard.user.role === 'presenter') {
      if (this.recording?.stop) {
        const recordingData = await this.recording.stop(this.egressInfo?.egressId ?? '')
        this.egressInfo = recordingData
        this.recordData = this.groupingPlayingData(this.egressInfo, this.blackboard.stackManager.getStacks())
      }
    }
    await this.room.disconnect();
    this.blackboard.onClose()
    console.log('disconnected from room');
  }
  addUser(user: BlackboardUserType, participant?: RemoteParticipant | null) {
    this.blackboard.userList.set(user.id, {
      ...user,
      userType: participant ? 'remote' : 'local',
      access: {
        mic: user.role === 'presenter',
        draw: user.role === 'presenter'
      }
    });
    this.blackboard.updated('addUser')
  }
  findParticipantByUserId(userId: string) {
    return Array.from(this.room.participants).find(([sid, participant]) => {
      return participant.identity === userId
    })
  }
  onRemoteDraw(userId: string) {
    const data = {
      type: 'draw-on',
      target: userId
    }
    this.publishData(JSON.stringify(data))
  }
  offRemoteDraw(userId: string) {
    const data = {
      type: 'draw-off',
      target: userId
    }
    this.publishData(JSON.stringify(data))
  }
  toggleDrawAble(userId: string) {
    const selectedUser = this.blackboard.userList.get(userId)
    if (selectedUser) {
      if (selectedUser.access.draw) {
        this.offRemoteDraw(userId)
      } else {
        this.onRemoteDraw(userId)
      }
      this.blackboard.userList.set(userId, { ...selectedUser, access: { ...selectedUser.access, draw: !selectedUser.access.draw } })
    }
    this.blackboard.updated('toggle draw able')
  }
  muteTracks(userId: string) {
    const data = {
      target: userId,
      type: 'mute',
    }
    this.publishData(JSON.stringify(data));
    this.blackboard.userList.set(userId, {
      ...this.blackboard.userList.get(userId)!,
      access: {
        ...this.blackboard.userList.get(userId)?.access!,
        mic: false
      }
    })
  }
  unmuteTracks(userId: string) {
    const data = {
      target: userId,
      type: 'unmute',
    }
    this.publishData(JSON.stringify(data));
    this.blackboard.userList.set(userId, {
      ...this.blackboard.userList.get(userId)!,
      access: {
        ...this.blackboard.userList.get(userId)?.access!,
        mic: true
      }
    })
  }
  toggleMic(userId: string) {
    const user = this.blackboard.userList.get(userId);
    if (!user) return;
    const access = user.access;
    if (!access) return;
    const mic = access.mic;
    if (mic) {
      this.muteTracks(userId);
    } else {
      this.unmuteTracks(userId);
    }
  }
  removeUser(userId: string) {
    this.blackboard.userList.delete(userId);
    this.blackboard.updated('removeUser')
  }
  getCurrentUserBy(userId: string) {
    return this.blackboard.userList.get(userId);
  }
  getRoomParticipants() {
    return this.room.participants;
  }
}
export default LiveControl;