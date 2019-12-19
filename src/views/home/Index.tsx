import React, { useRef, useState, useEffect } from 'react';
import io from 'socket.io-client';
import { List } from 'react-virtualized';
import {Button, Input} from "antd";


import './index.scss';

import iceServers from '../../services/iceServe';
import { SOCKET_URL, SOCKET_PATH } from '../../services/config';
import UserInfo from '../../userInfo'

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

let isAddWsListener: boolean = false;
let isAddRtcListener: boolean = false;

let localMsgList: string[] = [];


const App: React.FC = () => {
	const videoRef = useRef<HTMLVideoElement>(null);
	const remoteVideoRef = useRef<HTMLVideoElement>(null);
	const [cameraId, setCameraId] = useState('');
	const [chatHeight, setChatHeight] = useState(0);
	const [chatWidth, setChatWidth] = useState(0);
	const [chatMsgList, setChatMsgList] = useState<string[]>(() => localMsgList);
	const [chatMsg, setChatMsg] = useState('');
	const [onCalling, setOnCalling] = useState(false);

	const { userName, roomName } = UserInfo.getInfo();

	function handlerWinResize() {
		const container$ = document.querySelector<HTMLDivElement>('#chat--list');
		if (!container$) return;
		const { height, width } = container$.getBoundingClientRect();
		setChatHeight(height);
		setChatWidth(width);
	}
	window.addEventListener('resize', handlerWinResize);
	useEffect(() => {
		handlerWinResize();
		return () => window.removeEventListener('resize', handlerWinResize);
	});

	let localStream: MediaStream | null = null;

	let remoteStream: MediaStream | null = null;

	let isPublisher: boolean = true;

	let hasPublish: boolean = false;

	const rtc = new RTCPeerConnection({
		iceServers,
	});

	function addRtcListener() {
		if (isAddRtcListener) return;
		isAddRtcListener = true;
		rtc.addEventListener('track', (e) => {
			const video$ = remoteVideoRef.current;
			remoteStream = e.streams[0];
			if (video$ && video$.srcObject !== e.streams[0]) {
				video$.srcObject = remoteStream;
			}
		});

		rtc.addEventListener('icecandidate', (e) => {
			socket.emit('candidate', e.candidate);
		});
	}

	function addWsListener() {
		if (isAddWsListener) return;
		isAddWsListener = true;
		socket.on('send_sdp', async (e: SdpMsg) => {
			const { sender, data } = e;
			console.log('收到sdp', e);
			if (sender === userName) return;
			await rtc.setRemoteDescription(data);
		});

		socket.on('candidate', async (e: CandidateMsg) => {
			const { sender, data } = e;
			if (sender === userName) return;
			if (!data) {
				// playRemote();
				return;
			}
			try {
				console.log(data);
				await rtc.addIceCandidate(data as any);
			} catch (e) {
				console.error(e);
			}
		});

		socket.on('call', (e: SocketMsg) => {
			const { sender } = e;
			if (sender === userName) return;
			setOnCalling(true);
			isPublisher = false;
			publishStream();
		});

		socket.on('chat', (e:string) => {
			console.log('收到消息', chatMsgList, e);
			setChatMsgList([...chatMsgList, e]);
		});
	}

	addRtcListener();
	addWsListener();


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

	function handlerKeyDown(e: any) {
		const { key } = e as KeyboardEvent;
		if (key === 'Enter') {
			socket.emit('chat', chatMsg, (e: string) => {
				setChatMsg('');
				setChatMsgList([...chatMsgList, e]);
			});
		}
	}

	return (
			<div className="App">
				<div className="left"></div>
				<div className="center"></div>
				<div className="right">
					<div className="video--wrap">
						<video ref={remoteVideoRef} width="200" height="150" autoPlay={true}/>
						<video ref={videoRef} width="80" height="60" autoPlay={true} muted/>
					</div>
					<div id="chat--list" className="chat--list">
						<List width={chatWidth} height={chatHeight} rowHeight={20} rowCount={20} rowRenderer={({key, index, style}) => {
							return (<div key={key} style={style}>
								{chatMsgList[index]}
							</div>)
						}}/>
					</div>
					<Input placeholder="说点什么" value={chatMsg} onChange={e => setChatMsg(e.target.value)} onKeyDown={handlerKeyDown}/>
					<Button onClick={getLocalStream}>采集本地视频</Button>
					<Button onClick={loginRoom}>登录房间</Button>
					<Button disabled={onCalling} onClick={call}>call</Button>
				</div>
			</div>
	);
};

export default App;
