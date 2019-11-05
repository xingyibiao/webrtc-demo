import React, {useState} from 'react'
import { Input, Button, Icon } from 'antd'
import { useHistory } from 'react-router';
import './login.scss';
import UserInfo from '../../userInfo'


const Login: React.FC = () => {
	const [userName, setUserName] = useState('');
	const [roomName, setRoomName] = useState('');
	const history = useHistory();

	function login() {
		if (!userName || !roomName) return;
		UserInfo.setInfo({
			userName,
			roomName,
		});
		history.push('/');
		window.location.reload();
	}

	return (
		<div className="login">
			<div className="loginForm">
				<h1>逼格than逼格demo</h1>
				<div className="form--item">
					<Input value={userName} placeholder="请输入用户名" prefix={<Icon type="user" />} onChange={(e) => setUserName(e.target.value)}/>
				</div>
				<div className="form--item">
					<Input value={roomName} placeholder="请输入房间号" prefix={<Icon type="lock"/>} onChange={(e) => setRoomName(e.target.value)}/>
				</div>
				<div className="form--item">
					<Button type="primary" onClick={login}>登录</Button>
				</div>
			</div>
		</div>
	)
};

export default Login;
