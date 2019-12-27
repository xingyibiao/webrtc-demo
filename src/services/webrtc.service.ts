/**
 * webrtc sdk
 * copyright 邢毅彪
 */
import emitter from 'eventemitter3';
import io from 'socket.io-client';
import 'webrtc-adapter';

import { SOCKET_PATH, SOCKET_URL } from './config';
import iceServers from './iceServe';
import { SEND_SDP, CALL, CANDIDATE, LOGIN } from './event.type';

type SocketMsg<T = any> = {
  data: T;
  sender: string;
};

type SdpMsg = SocketMsg<RTCSessionDescription>;
type CandidateMsg = SocketMsg<RTCPeerConnectionIceEvent>;

export default class RTCClient extends emitter {
  static clientInstance: RTCClient;

  static getClientInstance(
    container: HTMLDivElement,
    constraints: MediaStreamConstraints,
  ): RTCClient {
    if (!RTCClient.clientInstance)
      RTCClient.clientInstance = new RTCClient(container, constraints);
    return RTCClient.clientInstance;
  }

  static socketOptions: SocketIOClient.ConnectOpts = {
    path: SOCKET_PATH,
    forceNew: true,
    reconnection: false,
    transports: ['websocket'],
  };

  static setSocketOptions(options: SocketIOClient.ConnectOpts) {
    RTCClient.socketOptions = options;
  }

  static socketUrl: string = SOCKET_URL;

  static setScocketUrl(url: string) {
    RTCClient.socketUrl = this.socketUrl;
  }

  static rtcConfig: RTCConfiguration = {
    iceServers,
  };

  static setRtcConfig(config: RTCConfiguration) {
    RTCClient.rtcConfig = config;
  }

  private socket: SocketIOClient.Socket | null = null;

  private rtc: RTCPeerConnection | null = null;

  private localVideo$: HTMLVideoElement | null = null;

  private remoteVideo$: HTMLVideoElement | null = null;

  private localStream: MediaStream | null = null;

  private remoteStream: MediaStream | null = null;

  private userName: string = '';

  private roomName: string = '';

  private isPublisher: boolean = false;

  private hasInit: boolean = false;

  private socketInitSuccess: boolean = false;

  private rtcInitSuccess: boolean = false;

  private hasPublish: boolean = false;

  constructor(
    private container: HTMLDivElement,
    private constraints: MediaStreamConstraints,
  ) {
    super();
  }

  private initContainer() {
    if (!this.container) return;
    const localVideo$ = document.createElement('video');
    const remoteVideo$ = document.createElement('video');
    localVideo$.width = 500;
    localVideo$.height = 500;
    remoteVideo$.width = 500;
    remoteVideo$.height = 500;

    this.localVideo$ = localVideo$;
    this.remoteVideo$ = remoteVideo$;
    this.container.appendChild(remoteVideo$);
    this.container.appendChild(localVideo$);
  }

  public init(): Promise<string> {
    this.initContainer();

    const that = this;
    return new Promise((resolve, reject) => {
      if (this.hasInit) {
        reject('重复init');
        return;
      }

      const { socketUrl, socketOptions, rtcConfig } = RTCClient;

      this.socket = io(socketUrl, socketOptions);

      this.rtc = new RTCPeerConnection(rtcConfig);

      function checkAllSuccess(): boolean {
        if (that.socketInitSuccess && that.rtcInitSuccess) return true;
        return false;
      }

      this.socket.addEventListener('connect', () => {
        this.socketInitSuccess = true;
        if (checkAllSuccess()) resolve();
      });

      this.rtc.addEventListener('connectionstatechange', () => {
        if (!this.rtc) return;
        const { connectionState } = this.rtc;
        switch (connectionState) {
          case 'connected':
            this.rtcInitSuccess = true;
            if (checkAllSuccess()) resolve();
            break;
          case 'disconnected':
          case 'failed':
            reject();
            break;
          case 'closed':
            console.log('rtc关闭');
            break;
        }
      });

      this.socket.addEventListener('error', () => reject());

      this.addSocketListener();
      this.addRtcListener();
    });
  }

  private addSocketListener() {
    // if (!this.socket) return;
    this?.socket.on(SEND_SDP, async (e: SdpMsg) => {
      const { sender, data } = e;
      console.log('收到sdp', e);
      if (sender === this.userName) return;
      if (this.rtc) {
        await this.rtc.setRemoteDescription(data);
      }
    });

    this.socket.on(CANDIDATE, async (e: CandidateMsg) => {
      const { sender, data } = e;
      if (sender === this.userName) return;
      if (!data) {
        return;
      }
      try {
        if (this.rtc) await this.rtc.addIceCandidate(data as any);
      } catch (e) {
        console.error(e);
      }
    });

    this.socket.on(CALL, (e: SocketMsg) => {
      const { sender } = e;
      if (sender === this.userName) return;
      this.emit('call');
      this.isPublisher = false;
      this.publishStream();
    });
  }

  private addRtcListener() {
    if (!this.rtc) return;
    this.rtc.addEventListener('track', e => {
      console.log('远端track增加', e.streams);
      const remoteStream = e.streams[0];
      this.remoteStream = remoteStream;
      if (this.remoteVideo$ && this.remoteVideo$.srcObject !== e.streams[0]) {
        this.remoteVideo$.srcObject = remoteStream;
      }
    });

    this.rtc.addEventListener('icecandidate', e => {
      this.socket && this.socket.emit('candidate', e.candidate);
    });
  }

  public login(roomName: string, userName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject('socket未连接');
      this.socket.emit(
        LOGIN,
        userName,
        roomName,
        (e: { success: boolean; isPublisher: boolean }) => {
          if (e.success) {
            this.userName = userName;
            this.roomName = roomName;
            this.isPublisher = this.isPublisher;
          } else {
            reject('登录失败');
          }
          // isPublisher = e;
          console.log('是不是发布者', e);
        },
      );
    });
  }

  public publishStream(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        await this.initLocalStream();

        await this.addTrack();

        if (this.isPublisher) {
          await this.createOffer();
        } else {
          await this.createAnswer();
        }

        resolve('发布流成功');
      } catch (e) {
        reject(e);
      }
    });
  }

  private initLocalStream(): Promise<any> {
    return new Promise((resolve, reject) => {
      navigator.mediaDevices
        .getUserMedia(this.constraints)
        .then(stream => {
          this.localStream = stream;
          if (this.localVideo$) {
            this.localVideo$.srcObject = stream;
          }
          resolve();
        })
        .catch(err => reject(err));
    });
  }

  private createOffer(): Promise<boolean> {
    if (this.hasPublish) return Promise.resolve(true);
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.rtc) return reject(false);
        const offer = await this.rtc.createOffer();
        this.hasPublish = true;
        if (offer.sdp) {
          this.rtc.setLocalDescription(offer);
          this.socket && this.socket.emit(SEND_SDP, offer);
          resolve(true);
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  private createAnswer(): Promise<boolean> {
    if (this.hasPublish) return Promise.resolve(true);
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.rtc) return reject(false);
        const answer = await this.rtc.createAnswer();
        this.hasPublish = true;
        if (answer.sdp) {
          this.rtc.setLocalDescription(answer);
          this.socket && this.socket.emit(SEND_SDP, answer);
          resolve(true);
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  private addTrack(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.localStream) return reject(false);
      this.localStream.getTracks().forEach(track => {
        if (!this.rtc) return reject(false);
        if (!this.localStream) return reject(false);
        this.rtc.addTrack(track, this.localStream);
        resolve(true);
      });
    });
  }

  // TODO implement destroy
  public destroy() {}
}
