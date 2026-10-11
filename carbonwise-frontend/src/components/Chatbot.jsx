import React, { useRef, useState } from "react";
import api from "../services/api";
//Added new Activity
const Chatbot = () => {

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const sending = useRef(false);

  const sendMessage = async () => {

    if (!input.trim() || sending.current) return;
    sending.current = true;

    const userMsg = { sender: "user", text: input };

    setMessages([...messages, userMsg]);

    try {

      const res = await api.post("/chat", {
        message: input
      });

      const botMsg = {
        sender: "bot",
        text: res.data.reply
      };

      setMessages(prev => [...prev, botMsg]);

    } catch {

      setMessages(prev => [
        ...prev,
        {
          sender: "bot",
          text: "AI service unavailable."
        }
      ]);

    }

    setInput("");
    sending.current = false;

  };

  return (
    <div className="chatbox">

      <div className="messages">

        {messages.map((m, i) => (
          <div key={i} className={m.sender}>
            {m.text}
          </div>
        ))}

      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask for eco tips..."
      />

      <button onClick={sendMessage}>Send</button>

    </div>
  );
};

export default Chatbot;