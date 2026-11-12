import React, { useState } from "react";
import sendMessageButton from "../../../resources/images/sendMessageButton.svg";
import * as wss from "../../../utils/wss";
import { connect } from "react-redux";

const NewMessage = ({ activeConversation, identity }) => {
  const [message, setMessage] = useState("");
  const canSend = Boolean(activeConversation?.socketId);

  const sendMessage = () => {
    if (!canSend || !message.trim()) {
      return;
    }

    wss.sendDirectMessage({
      receiverSocketId: activeConversation.socketId,
      identity: identity,
      messageContent: message,
    });

    setMessage("");
  };

  const handleTextChange = (event) => {
    setMessage(event.target.value);
  };

  const handleKeyPressed = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="new_message_container new_message_direct_border">
      <input
        className="new_message_input"
        value={message}
        onChange={handleTextChange}
        placeholder={
          canSend ? "Type your message.." : "Select a participant first"
        }
        type="text"
        disabled={!canSend}
        onKeyDown={handleKeyPressed}
      />
      <img
        className="new_message_button"
        src={sendMessageButton}
        alt="Send"
        onClick={sendMessage}
      />
    </div>
  );
};

const mapStoreStateToProps = (state) => {
  return {
    ...state,
  };
};

export default connect(mapStoreStateToProps)(NewMessage);
