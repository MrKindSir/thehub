import React from "react";
import VideoButtons from "./VideoButtons";

const VideoSection = () => {
  return (
    <div className="video_section_container">
      <div id="videos_portal" className="videos_portal" />
      <VideoButtons />
    </div>
  );
};

export default VideoSection;
