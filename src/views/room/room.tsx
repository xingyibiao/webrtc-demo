import React, {useEffect, useRef, useState} from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { Button, Modal } from 'antd';

import UserInfo from '../../userInfo';
import WebRtcService from '../../services/webrtc.service';

let rtc: WebRtcService | null = null;
let isInit = false;

const Room: React.FC = () => {
  const { id } = useParams();
  const { replace } = useHistory();
  const [ modalVisible, setModalVisible ] = useState(false);
  const [ callName, setCallName ] = useState('');
  const [ callDisable, setCallDisable ] = useState(false);
  const videoWrapRef$ = useRef<HTMLDivElement>(null);
  const { userName, roomName } = UserInfo.getInfo();

  if (!userName || !roomName) replace('/login');

  useEffect(() => {
    const { current } = videoWrapRef$;
    if (!current) return;
    rtc = WebRtcService.getClientInstance(current, {
      video: true,
      audio: true,
    });

    rtc.init()
      .then(() => {
        isInit = true;
        console.log('webRtc init success');

        rtc!.addListener('call', (name) => {
          setCallDisable(true);
          setCallName(name);
          setModalVisible(true);
        })

      })
      .catch((e) => {
        isInit = false;
        console.error('webRrc init error', e);
      });

    return () => {
      isInit = false;
      rtc && rtc.destroy();
    }
  }, [id]);

  function call() {
    if (callDisable) return;
    if (isInit && rtc) {
      rtc.call();
    }
  }

  function login() {
    if (isInit && rtc) {
      rtc.login(roomName, userName)
        .then((name) => {
          console.log('webrtc 登录成功')
        })
        .catch(e => {
          console.error('webrtc登录失败 e')
        })
    }
  }

  function closeModal() {
    setModalVisible(false);
  }

  function agreeCall() {
    closeModal();
    if (rtc) rtc.agree();
  }

  return (
    <>
      <div className="room">
        <div className="room--left">{id}</div>
        <div className="room--middle">middle</div>
        <div className="room--right">
          <div className="btn__list">
            <Button onClick={login}>login</Button>
            <Button onClick={call} disabled={callDisable}>call</Button>
          </div>
          <div id="video--wrap" ref={videoWrapRef$} />
        </div>
      </div>
      <Modal visible={modalVisible} onOk={agreeCall} onCancel={closeModal}>
        {callName} call you, Do you agree?
      </Modal>
    </>
  );
};

export default Room;
