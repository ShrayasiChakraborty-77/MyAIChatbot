"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { v4 as uuidv4 } from "uuid";

type Role = "user" | "ai";

interface Message {
  id: string;
  role: Role;
  text: string;
}

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [pdfContent, setPdfContent] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
    script.onload = () => {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
    };
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPdfFileName(file.name);

    const reader = new FileReader();
    reader.onload = async () => {
      const typedArray = new Uint8Array(reader.result as ArrayBuffer);

      const waitForPDFJS = () =>
        new Promise((resolve) => {
          const check = () => {
            if ((window as any).pdfjsLib?.getDocument) resolve(null);
            else setTimeout(check, 100);
          };
          check();
        });

      await waitForPDFJS();
      const pdfjsLib = (window as any).pdfjsLib;

      try {
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        let fullText = "";

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const content = await page.getTextContent();
          const text = content.items.map((item: any) => item.str).join(" ");
          fullText += text + "\n";
        }

        console.log("📄 PDF Contents:\n", fullText);
        setPdfContent(fullText);
      } catch (err) {
        console.error("❌ Error reading PDF:", err);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const combinedText = pdfContent ? `${input}\n\n[PDF Content Below]\n${pdfContent}` : input;

    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      text: input,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const contents = [
      ...newMessages.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }],
      })),
      {
        role: "user",
        parts: [{ text: combinedText }],
      },
    ];

    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=ENTER YOUR GEMINI API KEY",
        
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ contents }),
        }
      );

      const data = await response.json();

      const botText: string =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || "AI could not respond.";

      const botReply: Message = {
        id: uuidv4(),
        role: "ai",
        text: botText,
      };

      setMessages((prev) => [...prev, botReply]);
    } catch (error) {
      console.error("Error fetching AI response:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-gradient-to-br from-sky-950 to-blue-900 text-white">
      {showHistory && (
        <div className="hidden md:flex w-1/4 flex-col border-r border-cyan-700 p-4 bg-blue-950">
          <h2 className="text-lg font-semibold mb-4">📜 Previous Chats</h2>
          <ul className="space-y-2 text-sm text-blue-300">
            {messages
              .filter((msg) => msg.role === "user")
              .map((msg, idx) => (
                <li key={msg.id} className="truncate">
                  {idx + 1}. {msg.text.slice(0, 40)}...
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col flex-grow max-w-2xl mx-auto p-4">
        <h1 className="text-3xl font-extrabold mb-4 text-center">
          Shrayasi's Chatbot🚀
        </h1>

        <ScrollArea className="flex-1 overflow-y-auto space-y-4 border rounded-lg p-4 bg-[#162236] shadow-lg">
          {messages.map((msg) => (
            <Card
              key={msg.id}
              className={`w-fit max-w-[75%] shadow ${
                msg.role === "user" ? "ml-auto bg-cyan-800 text-white" : "mr-auto bg-blue-100 text-black"
              }`}
            >
              <CardContent className="p-3">
                <p className="text-sm whitespace-pre-wrap">
                  <strong>{msg.role === "user" ? "You" : "AI"}:</strong> {msg.text}
                </p>
              </CardContent>
            </Card>
          ))}

          {loading && (
            <Card className="w-fit mr-auto bg-blue-100 text-black animate-pulse">
              <CardContent className="p-3">
                <p className="text-sm">
                  <strong>AI:</strong> Typing...
                </p>
              </CardContent>
            </Card>
          )}

          <div ref={bottomRef} />
        </ScrollArea>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2 pt-4"
        >
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-gray-800 text-white border-cyan-600"
          />
          <Button type="submit" disabled={loading}>
            Send
          </Button>
        </form>

        <div className="pt-4">
          <input
            type="file"
            accept="application/pdf"
            ref={fileInputRef}
            onChange={handlePdfUpload}
            className="text-sm text-blue-300"
          />
        </div>

        {/* Show file only if user asks */}
        {pdfFileName && input.toLowerCase().includes("file") && (
          <div className="mt-4 text-sm text-blue-400">
            <strong>Uploaded:</strong> 📄 {pdfFileName}
          </div>
        )}
      </div>
    </div>
  );
}
