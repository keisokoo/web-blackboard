import { DataPacket_Kind, LocalTrackPublication, ParticipantEvent, RemoteParticipant, RemoteTrack, RemoteTrackPublication, Room, RoomEvent, Track, createLocalAudioTrack } from "livekit-client";
import generateHash from "../helper/generateHash";
import { parseNanoToMilliseconds } from "../helper/timestamp";
import Blackboard from "./Blackboard";
import WBLine from "./WBLine";
import { BlackboardUserType, ChatMessage, EgressInfo, RecordDataType, RoleType, StackType } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type NotifyData = {
  type: 'request-draw' | 'request-mic' | 'egress_started' | 'init' | 'mute' | 'unmute' | 'draw-on' | 'draw-off'
  target?: string // 전달 대상이 되는 user id or 'all'
  requestId?: string // 요청자 id
}

class LiveControl {
  private wsURL: string = '';
  private wsToken: string = '';

  recordThreshold: number = 1000; // milliseconds

  recordLimit: number = 20 * 60 * 1000; // milliseconds

  limitTime: number = 0; // milliseconds

  limitTimeout: NodeJS.Timeout | null = null;

  room: Room;
  publishTrack: LocalTrackPublication | null = null;
  audioElement: HTMLAudioElement | null = null;

  blackboard: Blackboard;

  recording?: {
    start: (roomName: string) => Promise<EgressInfo | null>,
    stop: (egressId: string, isCancel?: boolean) => Promise<EgressInfo | null>,
  }

  notify: (data: NotifyData) => void = () => { };

  timerCallback: (data: { limitTime: number, recordLimit: number }) => void = () => { };
  timerEndCallback: null | ((liveControl: LiveControl) => void) = null

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

  setTimerCallback(timerCallback: (data: { limitTime: number, recordLimit: number }) => void, timerEndCallback?: (liveControl: LiveControl) => void) {
    if (this.limitTimeout) clearTimeout(this.limitTimeout)
    this.timerCallback = timerCallback
    if (timerEndCallback) this.timerEndCallback = timerEndCallback
  }

  clearLimitTime() {
    this.limitTime = 0;
    if (this.limitTimeout) clearTimeout(this.limitTimeout)
  }

  pauseLimitTime() {
    if (this.limitTimeout) clearTimeout(this.limitTimeout)
  }

  checkLimitTime() {
    this.limitTimeout = setTimeout(() => {
      if (this.limitTime >= this.recordLimit) {
        if (this.timerEndCallback) {
          this.timerEndCallback(this)
        } else {
          this.disconnect()
        }
        clearTimeout(this.limitTimeout!)
        return
      }
      this.limitTime += 1000;
      this.timerCallback({ limitTime: this.limitTime, recordLimit: this.recordLimit })
      this.checkLimitTime()
    }, 1000)
  }

  setNotify(notify: (data: NotifyData) => void) {
    this.notify = notify;
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
  publishData(data: string, sids?: string[]) {
    if (this.room.state !== 'connected') return
    if (this.room.participants.size === 0) return
    const strData = encoder.encode(data);
    const sidsTarget = sids && sids.length > 0 ? sids : Array.from(this.room.participants).map(([sid, participant]) => sid)
    this.room.localParticipant?.publishData(strData, DataPacket_Kind.RELIABLE, sidsTarget);
  }
  chat(message: string) {
    const data = {
      type: 'chat',
      data: {
        message: message,
        sender: this.blackboard.user.id,
        nickname: this.blackboard.user.nickname,
        timestamp: Date.now()
      } as ChatMessage
    }
    this.publishData(JSON.stringify(data))
    this.blackboard.chatCallback(data.data)
    return data.data
  }
  receiveData(data: string) {
    const decoded = JSON.parse(data);
    if (!decoded) return
    if (decoded.target && decoded.target === this.blackboard.user.id && decoded.type) {
      if (decoded.type === 'request-draw') {
        this.notify(decoded)
      }
      if (decoded.type === 'request-mic') {
        this.notify(decoded)
      }
      if (decoded.type === 'egress_started') {
        setTimeout(() => {
          this.blackboard.nowRecord = true
          this.blackboard.updated('record start')
        }, this.recordThreshold)
      }
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
          wb.setTimestamp({ start: Date.now() })
          this.blackboard.setNewLine(wb);
          this.blackboard.handlers.bindHitLineEvent(wb);
        } else if (decoded.type === 'remote-move') {
          const wb = this.blackboard.getLastLine(decoded.userId);
          if (!wb) return
          const newPoints = wb.line.points().concat(decoded.nextPoints);
          wb.line.points(newPoints);
          this.blackboard.layer.batchDraw();
        } else if (decoded.type === 'remote-up') {
          const wb = this.blackboard.getLastLine(decoded.userId);
          if (!wb) return
          wb.setTimestamp({ end: Date.now() })
          this.blackboard.stackManager.addStack({
            id: `stack-${generateHash()}`,
            action: 'add',
            timeline: {
              start: wb.timestamp.start,
              end: wb.timestamp.end,
              duration: (wb.timestamp.end - wb.timestamp.start)
            },
            paint: {
              id: wb.line.id(),
              type: wb.type,
              lineConfig: wb.config.lineConfig,
              points: wb.line.points()
            }
          }, true, false)
          const currentStacks = this.blackboard.stackManager.getStacks()
          console.log('added stack', currentStacks[currentStacks.length - 1])
          this.blackboard.layer.batchDraw();
        }
      } else {
        if (this.blackboard.stackManager.isStackType(decoded)) {
          const stack = decoded as StackType;
          this.blackboard.stackManager.runStack(stack);
          this.blackboard.stackManager.addStack(stack, false, false);
        }
        if (decoded.type === 'chat') {
          this.blackboard.chatCallback(decoded.data)
        }
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
      if (this.blackboard.user.role === 'presenter') {
        if (this.recording?.start) {
          const recordingData = await this.recording.start(currentRoom.name)
          this.blackboard.egressInfo = recordingData
          this.blackboard.updated('egress start')
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
      currentRoom.localParticipant?.publishData(strData, DataPacket_Kind.RELIABLE, [participant.sid]);
    })
    currentRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
      const presenter = this.blackboard.userList.get(participant.identity)
      this.removeUser(participant.identity)
      if (presenter?.role === 'presenter') {
        this.disconnect()
        this.blackboard.nowRecord = false
        this.blackboard.updated('record end')
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
    const startTime = parseNanoToMilliseconds(fileResult?.startedAt ?? egressInfo.startedAt ?? 0) // milliseconds
    const endTime = parseNanoToMilliseconds(fileResult?.endedAt ?? egressInfo.endedAt ?? 0) // milliseconds
    const duration = parseNanoToMilliseconds(fileResult?.duration ?? 0) / 1000 // seconds
    const result = {
      filename: fileResult?.filename ?? '',
      firstImage: this.blackboard.firstBackgroundImage,
      audioInfo: {
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        historyStack: stacks
      }
    }
    return result
  }
  async disconnect() {
    if (this.blackboard.user.role === 'presenter') {
      if (this.recording?.stop) {
        const recordingData = await this.recording.stop(this.blackboard.egressInfo?.egressId ?? '')
        this.blackboard.egressInfo = recordingData
        this.blackboard.recordData = this.groupingPlayingData(this.blackboard.egressInfo, this.blackboard.stackManager.getStacks())
        console.log('this.blackboard.recordData', this.blackboard.recordData)
        this.blackboard.updated('record done')
      }
    }
    await this.room.disconnect();
    this.blackboard.onClose()
    console.log('disconnected from room');
  }
  async cancelRecording() {
    if (this.blackboard.user.role === 'presenter') {
      if (this.recording?.stop) {
        await this.recording.stop(this.blackboard.egressInfo?.egressId ?? '', true)
        this.blackboard.egressInfo = null
        this.blackboard.recordData = null
        this.blackboard.nowRecord = false
        this.blackboard.updated('record cancel')
      }
    }
  }
  addUser(user: BlackboardUserType, participant?: RemoteParticipant | null) {
    this.blackboard.userList.set(user.id, {
      ...user,
      sid: participant?.sid ?? '',
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
  requestRemoteDraw(userId: string, sid: string) {
    const presenter = Array.from(this.blackboard.userList).find(([id, user]) => {
      return user.role === 'presenter'
    })?.[0]
    if (!presenter) return
    const data = {
      type: 'request-draw',
      target: presenter,
      requestId: userId
    }
    this.publishData(JSON.stringify(data), sid ? [sid] : undefined)
  }
  onRemoteDraw(userId: string, sid: string) {
    const data = {
      type: 'draw-on',
      target: userId
    }
    this.publishData(JSON.stringify(data), sid ? [sid] : undefined)
    this.blackboard.userList.set(userId, {
      ...this.blackboard.userList.get(userId)!,
      access: {
        ...this.blackboard.userList.get(userId)?.access!,
        draw: true
      }
    })
  }
  offRemoteDraw(userId: string, sid: string) {
    const data = {
      type: 'draw-off',
      target: userId,
    }
    this.publishData(JSON.stringify(data), sid ? [sid] : undefined)
    this.blackboard.userList.set(userId, {
      ...this.blackboard.userList.get(userId)!,
      access: {
        ...this.blackboard.userList.get(userId)?.access!,
        draw: false
      }
    })
  }
  toggleDrawAble(userId: string, sid: string) {
    const selectedUser = this.blackboard.userList.get(userId)
    if (selectedUser) {
      if (selectedUser.access.draw) {
        this.offRemoteDraw(userId, sid)
      } else {
        this.onRemoteDraw(userId, sid)
      }
      this.blackboard.userList.set(userId, { ...selectedUser, access: { ...selectedUser.access, draw: !selectedUser.access.draw } })
    }
    this.blackboard.updated('toggle draw able')
  }
  requestRemoteMic(userId: string, sid: string) {
    const presenter = Array.from(this.blackboard.userList).find(([id, user]) => {
      return user.role === 'presenter'
    })?.[0]
    if (!presenter) return
    const data = {
      type: 'request-mic',
      target: presenter,
      requestId: userId
    }
    this.publishData(JSON.stringify(data), sid ? [sid] : undefined)
  }
  muteTracks(userId: string, sid: string) {
    const data = {
      target: userId,
      type: 'mute',
    }
    this.publishData(JSON.stringify(data), sid ? [sid] : undefined);
    this.blackboard.userList.set(userId, {
      ...this.blackboard.userList.get(userId)!,
      access: {
        ...this.blackboard.userList.get(userId)?.access!,
        mic: false
      }
    })
  }
  unmuteTracks(userId: string, sid: string) {
    const data = {
      target: userId,
      type: 'unmute',
    }
    this.publishData(JSON.stringify(data), sid ? [sid] : undefined);
    this.blackboard.userList.set(userId, {
      ...this.blackboard.userList.get(userId)!,
      access: {
        ...this.blackboard.userList.get(userId)?.access!,
        mic: true
      }
    })
  }
  toggleMic(userId: string, sid: string) {
    const user = this.blackboard.userList.get(userId);
    if (!user) return;
    const access = user.access;
    if (!access) return;
    const mic = access.mic;
    if (mic) {
      this.muteTracks(userId, sid);
    } else {
      this.unmuteTracks(userId, sid);
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