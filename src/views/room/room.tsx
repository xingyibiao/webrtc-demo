import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

import WebRtcService from '../../services/webrtc.service';

let rtc: WebRtcService | null = null;

const Room: React.FC = () => {
  const { id } = useParams();
  const videoWrapRef$ = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { current } = videoWrapRef$;
    if (!current) return;
    rtc = WebRtcService.getClientInstance(current, {
      video: true,
      audio: true,
    });

    rtc.init();

    return rtc.destroy();
  }, [id]);

  return (
    <div className="room">
      <div className="room--left">{id}</div>
      <div className="room--middle">middle</div>
      <div className="room--right">
        <div id="video--wrap" ref={videoWrapRef$} />
      </div>
    </div>
  );
};

export default Room;
