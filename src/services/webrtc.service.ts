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

interface ContainerStyleType {
  width: number,
  height: number,
}

const DefaultContainerStyle: ContainerStyleType = {
  width: 200,
  height: 200,
};

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

  private hasPublish: boolean = false;

  private readonly containerStyle!: ContainerStyleType;

  private agreeCall: boolean = false;

  private receiveSap: boolean = false;

  constructor(
    private container: HTMLDivElement,
    private constraints: MediaStreamConstraints,
    containerStyle?: ContainerStyleType
  ) {
    super();
    this.containerStyle = Object.assign({}, DefaultContainerStyle, containerStyle);
  }

  private initContainer() {
    if (!this.container) return;
    const localVideo$ = document.createElement('video');
    const remoteVideo$ = document.createElement('video');
    const { width, height } = this.containerStyle;
    this.container.setAttribute('style', `position: relative; width: ${width}px; height: ${height}px`);
    localVideo$.width = width * 0.25;
    localVideo$.height = height * 0.25;
    localVideo$.style.background = '#999';
    localVideo$.style.position = 'absolute';
    localVideo$.style.bottom = `0`;
    localVideo$.style.right = `0`;
    localVideo$.setAttribute('autoPlay', 'autoPlay');
    localVideo$.setAttribute('mute', 'mute');

    remoteVideo$.width = width;
    remoteVideo$.height = height;
    remoteVideo$.style.background = '#000';
    remoteVideo$.style.position = 'absolute';
    remoteVideo$.setAttribute('autoPlay', 'autoPlay');


    this.localVideo$ = localVideo$;
    this.remoteVideo$ = remoteVideo$;
    this.container.appendChild(remoteVideo$);
    this.container.appendChild(remoteVideo$);
    this.container.appendChild(localVideo$);
  }

  /**
   * 初始化
   */
  public init(): Promise<string> {
    this.initContainer();

    const that = this;
    return new Promise((resolve, reject) => {
      console.log('开始init', this.hasInit);
      if (this.hasInit) {
        reject('重复init');
        return;
      }

      const { socketUrl, socketOptions, rtcConfig } = RTCClient;

      this.socket = io(socketUrl, socketOptions);

      this.rtc = new RTCPeerConnection(rtcConfig);

      this.socket.addEventListener('connect', () => {
        resolve();
      });

      this.rtc.addEventListener('signalingstatechange', (e) => {
        console.log('signalingstatechange', e);
      });

      this.rtc.addEventListener('connectionstatechange', () => {
        console.log('rtc connectionStateChange');
        if (!this.rtc) return;
        const { connectionState } = this.rtc;
        console.log('connectionState %s', connectionState);
      });

      this.socket.addEventListener('error', () => reject());

      this.addSocketListener();
      this.addRtcListener();
    });
  }

  /**
   * 添加socket监听
   */
  private addSocketListener() {
    if (!this.socket) return;
    this.socket.on(SEND_SDP, async (e: SdpMsg) => {
      const { sender, data } = e;
      console.log('收到sdp', e);
      if (sender === this.userName) return;
      this.receiveSap = true;
      if (this.rtc) {
        await this.rtc.setRemoteDescription(data);
        if (this.agreeCall) this.publishStream();
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
      this.emit('call', sender);
      this.isPublisher = false;
      this.publishStream();
    });
  }

  /**
   * 添加rtc监听
   */
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

  /**
   * 登录房建
   * @param roomName
   * @param userName
   */
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
            this.isPublisher = e.isPublisher;
          } else {
            reject('登录失败');
          }
          // isPublisher = e;
          console.log('是不是发布者', e);
        },
      );
    });
  }

  /**
   * 发布流
   */
  private publishStream(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        await this.initLocalStream();

        await this.addTrack();
        console.log('isPublisher', this.isPublisher);
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

  /**
   * 发起通话请求
   */
  public call() {
    if (!this.socket) return;
    this.socket.emit(CALL, '', (e: SocketMsg) => {
      console.log('call cb', e);
      this.isPublisher = true;
      this.publishStream();
    });
  }

  /**
   * 接受通话请求
   */
  public agree() {
    this.agreeCall = true;
    if (this.receiveSap) this.publishStream();
  }

  /**
   * 初始化本地视频
   */
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

  /**
   * create offer
   */
  private createOffer(): Promise<boolean> {
    if (this.hasPublish) return Promise.resolve(true);
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.rtc) return reject(false);
        const offer = await this.rtc.createOffer();
        this.hasPublish = true;
        if (offer.sdp) {
          await this.rtc.setLocalDescription(offer);
          this.socket && this.socket.emit(SEND_SDP, offer);
          resolve(true);
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * create answer
   */
  private createAnswer(): Promise<boolean> {
    if (this.hasPublish) return Promise.resolve(true);
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.rtc) return reject(false);
        const answer = await this.rtc.createAnswer();
        this.hasPublish = true;
        if (answer.sdp) {
          await this.rtc.setLocalDescription(answer);
          this.socket && this.socket.emit(SEND_SDP, answer);
          resolve(true);
        }
      } catch (e) {
        console.error('create answer error', e);
        reject(e);
      }
    });
  }

  /**
   * 添加track
   */
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

  /**
   * 重置关键状态
   */
  private resetState() {
    this.socket = null;
    this.rtc = null;
    this.agreeCall = false;
    this.isPublisher = false;
  }

  /**
   * destroy
   */
  public destroy() {
    if (this.socket) this.socket.close();
    if (this.rtc) this.rtc.close();
    this.resetState();
  }
}
