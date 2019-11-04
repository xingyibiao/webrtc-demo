import React, {useRef, useState} from 'react';
import io from 'socket.io-client';

import iceServers from './iceServe';
import { SOCKET_URL, SOCKET_PATH } from './config';

type SdpMsg = SocketMsg<RTCSessionDescription>

type CandidateMsg = SocketMsg<RTCPeerConnectionIceEvent>

type SocketMsg<T = any> = {
	data: T,
	sender: string,
}


const socket = io(SOCKET_URL, {
	path: SOCKET_PATH,
	forceNew: true,
	reconnection: false,
	transports: ['websocket'],
});


const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callBtnRef = useRef<HTMLButtonElement>(null);
  const [cameraId, setCameraId] = useState('');
  const [userName, setUserName] = useState('');
  const [roomName, setRoomName] = useState('');
  let localStream: MediaStream | null = null;

  let remoteStream: MediaStream | null = null;

  let isPublisher: boolean = true;

  let hasPublish: boolean = false;

  const rtc = new RTCPeerConnection({
	  iceServers,
  });
  console.log(SOCKET_URL, SOCKET_PATH);


  rtc.addEventListener('track', (e) => {
  	console.log('远端track增加', e.streams);
  	const video$ = remoteVideoRef.current;
  	remoteStream = e.streams[0];
  	if (video$ && video$.srcObject !== e.streams[0]) {
  		video$.srcObject = remoteStream;
	  }
  });

  rtc.addEventListener('icecandidate', (e) => {
  	socket.emit('candidate', e.candidate);
  });

  async function createOffer() {
  	if (hasPublish) return;
    try {
      const offer = await rtc.createOffer();
      hasPublish = true;
      if (offer.sdp) {
        await rtc.setLocalDescription(offer);
        socket.emit('send_sdp', offer);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function createAnswer() {
  	if (hasPublish) return;
    try {
      const answer = await rtc.createAnswer();
      hasPublish = true;
      if (answer.sdp) {
        await rtc.setLocalDescription(answer);
        socket.emit('send_sdp', answer);
      }
    } catch (e) {
      console.error(e);
    }
  }

  socket.on('send_sdp', async (e: SdpMsg) => {
    const { sender, data } = e;
    console.log('收到sdp', e);
    if (sender === userName) return;
    await rtc.setRemoteDescription(data);
  });



  function handlerGetCamera() {
    navigator.getUserMedia({ video: true }, (e) => {
      console.log(e);
      setCameraId(e.id);

    }, (e) => {
      console.error(e)
    })
  }

  function getLocalStream() {
    navigator.mediaDevices.getUserMedia({audio: true, video: true})
        .then((e) => {
          if (videoRef.current) {
            videoRef.current.srcObject = e;
            localStream = e;
          }
        })
        .catch((e) => {
          console.error(e);
        })
  }

  function loginRoom() {
    socket.emit('login', userName, roomName, (e: boolean) => {
      isPublisher = e;
      console.log('是不是发布者', e);
    });
  }

  rtc.addEventListener('negotiationneeded', (e) => {
  	console.log('rtc state', rtc.signalingState);
    if (rtc.signalingState !== 'stable') return;
  });


  async function publishStream() {
  	if (!localStream) return;
  	localStream.getTracks().forEach((track) => {
  	  if (!localStream) return;
  		rtc.addTrack(track, localStream);
	  });
    if (isPublisher) {
      await createOffer();
    } else {
      await createAnswer();
    }
  }

  async function call() {
  	isPublisher = true;
	  await publishStream();
	  socket.emit('call');
  }

  function playRemote() {
	  if (!remoteStream) return;
	  const remoteVideo$ = remoteVideoRef.current;
	  if (!remoteVideo$) return;
	  remoteVideo$.srcObject = remoteStream;
  }


  return (
    <div className="App">
      <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)}/>
      <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)}/>
      <button onClick={handlerGetCamera}>获取摄像头</button>
      <button onClick={getLocalStream}>采集本地视频</button>
      <button onClick={loginRoom}>登录房间</button>
      <button ref={callBtnRef} onClick={call}>call</button>
      <span>{cameraId}</span>
      <video ref={videoRef} width="500" height="500" autoPlay={true} muted/>
      <video ref={remoteVideoRef} width="500" height="500" autoPlay={true}/>
    </div>
  );
};

export default App;
