// app/api/ollama-proxy/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { model, prompt, stream } = await request.json();

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        stream,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error:", errorText);
      return NextResponse.json(
        { error: "Failed to generate response", details: errorText },
        { status: response.status }
      );
    }

    return new NextResponse(response.body, {
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error("Fetch Error:", error);
    const errorMessage = (error as Error).message;
    return NextResponse.json(
      { error: "Failed to connect to the API", details: errorMessage },
      { status: 500 }
    );
  }
}
