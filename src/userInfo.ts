type Info = {
	userName: string,
	roomName: string,
}

class UserInfo {
	static instance: UserInfo;

	private info: Info = {
		userName: '',
		roomName: '',
	};

	static getInstance() {
		if (!UserInfo.instance) UserInfo.instance = new UserInfo();
		return UserInfo.instance;
	}

	constructor() {
		const userInfo = localStorage.getItem('userInfo');
		if (userInfo) {
			try {
				const info = JSON.parse(userInfo);
				this.setInfo(info);
			} catch (e) {
				console.error('获取本地用户信息失败');
			}
		}
	}

	setInfo(info: Info) {
		this.info = info;
		localStorage.setItem('userInfo', JSON.stringify(info));
	}

	getInfo() {
		return this.info;
	}
}

const UserInfoInstance = UserInfo.getInstance();

export default UserInfoInstance;
