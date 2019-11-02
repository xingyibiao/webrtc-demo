import React, {useRef, useState} from 'react';
import io from 'socket.io-client';

import iceServers from './iceServe';

type SdpMsg = SocketMsg<RTCSessionDescription>

type CandidateMsg = SocketMsg<RTCPeerConnectionIceEvent>

type SocketMsg<T = any> = {
	data: T,
	sender: string,
}


const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
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
  const socket = io('https://www.xingyibiao.com/', {
    path: '/chat/socket.io',
    forceNew: true,
    reconnection: false,
    transports: ['websocket'],
	  rejectUnauthorized: false,
  });

  rtc.addEventListener('track', (e) => {
  	console.log('远端track增加', e.streams);
  	const video$ = remoteVideoRef.current;
  	console.log(video$);
  	remoteStream = e.streams[0];
  	if (video$ && video$.srcObject !== e.streams[0]) {
  		console.log(localStream, remoteStream);
  		video$.srcObject = localStream;
	  }
  });

  rtc.addEventListener('icecandidate', (e) => {
  	console.log('ice', e);
  	socket.emit('candidate', e);
  });

  async function createOffer() {
  	if (hasPublish) return;
    try {
      const offer = await rtc.createOffer();
      hasPublish = true;
      console.log('创建offer', offer);
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
      console.log('创建answer', answer);
      if (answer.sdp) {
        await rtc.setLocalDescription(answer);
        socket.emit('send_sdp', answer);
	      // playRemote();
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
    // createAnswer();
  });

  socket.on('candidate', async (e: CandidateMsg) => {
  	const { sender, data } = e;
  	if (sender === userName) return;
  	if (!data.candidate) {
  		// playRemote();
  		return;
	  }
  	try {
  		console.log(data);
  	  await rtc.addIceCandidate(data.candidate);
	  } catch (e) {
		  console.error(e);
	  }
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
            // e.getTracks().forEach((track) => {
            // 	rtc.addTrack(track);
            // })
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


  function publishStream() {
  	if (!localStream) return;
  	localStream.getTracks().forEach((track) => {
  	  if (!localStream) return;
  		rtc.addTrack(track, localStream);
	  });
    if (isPublisher) {
      createOffer().catch(() => createAnswer());
    } else {
      createAnswer();
    }
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
      <button onClick={publishStream}>发布流</button>
      <span>{cameraId}</span>
      <video ref={videoRef} width="500" height="500" autoPlay={true} muted/>
      <video ref={remoteVideoRef} width="500" height="500" autoPlay={true}/>
    </div>
  );
}

export default App;
