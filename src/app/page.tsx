"use client";
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import { Highlight, themes } from "prism-react-renderer";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { Send, Copy, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const inter = Inter({ subsets: ["latin"] });

interface Message {
  role: "user" | "assistant";
  content: string;
}

const ChatBubble: React.FC<Message> = ({ role, content }) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("Code copied to clipboard!");
    });
  };

  return (
    <div
      className={cn(
        inter.className,
        `flex ${role === "assistant" ? "justify-start" : "justify-end"} mb-4`
      )}
    >
      <div
        className={cn(
          "max-w-[80%] p-4 rounded-lg",
          role === "assistant"
            ? "bg-gray-100 text-gray-800"
            : "bg-blue-500 text-white"
        )}
      >
        <ReactMarkdown
          components={{
            code({ inline, className, children, ...props }: { inline?: boolean, className?: string, children?: React.ReactNode }) {
              const match = /language-(\w+)/.exec(className || "");
              return !inline && match ? (
                <div className="relative mt-2 mb-2">
                  <div className="bg-gray-800 rounded-lg p-1">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-400">{match[1]}</span>
                      <button
                        onClick={() => copyToClipboard(String(children))}
                        className="text-gray-400 hover:text-gray-200 transition-colors"
                        title="Copy code"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                    <Highlight
                      theme={themes.vsDark}
                      code={String(children).replace(/\n$/, "")}
                      language={match[1] as string}
                    >
                      {({
                        className,
                        style,
                        tokens,
                        getLineProps,
                        getTokenProps,
                      }) => (
                        <pre
                          className={className}
                          style={{ ...style, padding: "0.5em" }}
                        >
                          {tokens.map((line, i) => (
                            <div key={i} {...getLineProps({ line, key: i })}>
                              {line.map((token, key) => (
                                <span
                                  key={key}
                                  {...getTokenProps({ token, key })}
                                />
                              ))}
                            </div>
                          ))}
                        </pre>
                      )}
                    </Highlight>
                  </div>
                </div>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
};

const SettingsModal: React.FC<{
  modelName: string;
  setModelName: (name: string) => void;
  apiUrl: string;
  setApiUrl: (url: string) => void;
}> = ({ modelName, setModelName, apiUrl, setApiUrl }) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button variant="ghost" size="icon">
        <Settings className="h-[1.2rem] w-[1.2rem]" />
      </Button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Chat Settings</DialogTitle>
        <DialogDescription>
          Configure your chat model and API settings here.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <label htmlFor="model" className="text-right">
            Model
          </label>
          <Input
            id="model"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            className="col-span-3"
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <label htmlFor="apiUrl" className="text-right">
            API URL
          </label>
          <Input
            id="apiUrl"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            className="col-span-3"
          />
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [modelName, setModelName] = useState<string>("llama3");
  const [apiUrl, setApiUrl] = useState<string>("http://localhost:11434");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ollama-proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          prompt: input,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      const assistantMessage: Message = { role: "assistant", content: "" };

      setMessages((prevMessages) => [...prevMessages, assistantMessage]);

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.trim() === "") continue;

          try {
            const data = JSON.parse(line);
            if (data.response) {
              assistantMessage.content += data.response;
              setMessages((prevMessages) => [
                ...prevMessages.slice(0, -1),
                { ...assistantMessage },
              ]);
            }
          } catch (error) {
            console.error("Error parsing JSON:", error);
            setMessages((prevMessages) => [
              ...prevMessages,
              {
                role: "assistant",
                content: `Error: Invalid response from the API.`,
              },
            ]);
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "An unknown error occurred"
          }`,
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    }

    setIsLoading(false);
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className={cn(inter.className, "flex flex-col h-screen bg-white")}>
      <div className="flex flex-col flex-grow overflow-hidden">
        <header className="flex justify-between items-center p-4">
          <h1 className="text-xl font-semibold">Ollama Chat</h1>
          <div className="flex items-center space-x-2">
            <SettingsModal
              modelName={modelName}
              setModelName={setModelName}
              apiUrl={apiUrl}
              setApiUrl={setApiUrl}
            />
            <Button variant="outline" onClick={clearChat}>
              Clear Chat
            </Button>
          </div>
        </header>
        <hr />
        <main className="flex-grow flex flex-col overflow-hidden">
          <div
            ref={chatContainerRef}
            className="flex-grow overflow-y-auto p-4 space-y-4 px-10"
          >
            {messages.map((message, index) => (
              <ChatBubble key={index} {...message} />
            ))}
            {isLoading && (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            )}
          </div>
          <div className="p-4 border-t bg-white">
            <form onSubmit={handleSubmit} className="flex space-x-2">
              <Input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-grow"
              />
              <Button type="submit" disabled={isLoading}>
                <Send size={20} />
              </Button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
