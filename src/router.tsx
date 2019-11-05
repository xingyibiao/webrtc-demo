import React from 'react';
import { BrowserRouter as Router, Route, Redirect } from 'react-router-dom';
// import App from './App';
import UserInfo from './userInfo'
import Login from './views/login/Login';
import Index from './views/home/Index';

export default function () {
	const userInfo = UserInfo.getInfo();
	console.log(userInfo);
	return (
		<Router>
			{userInfo.userName ? <Route path="/" component={Index}/> : <Redirect to="/login" />}
			<Route path="/login" component={Login}/>
		</Router>
	)
}
