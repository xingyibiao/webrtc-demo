import React from 'react';
import {
  BrowserRouter as Router,
  Route,
  Redirect,
  Switch,
} from 'react-router-dom';
// import App from './App';
import UserInfo from './userInfo';
import Login from './views/login/Login';
import Index from './views/home/Index';
import Room from './views/room/room';

export default function() {
  const userInfo = UserInfo.getInfo();
  console.log(userInfo);
  return (
    <Router>
      <Switch>
        {userInfo.userName ? (
          <Route exact path="/" component={Index} />
        ) : (
          <Redirect to="/login" />
        )}
        <Route path="/login" component={Login} />
        <Route path="/room/:id" component={Room} />
      </Switch>
    </Router>
  );
}
