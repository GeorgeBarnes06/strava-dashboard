// src/ExchangeToken.js
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

function ExchangeToken() {
    const [searchParams] = useSearchParams();

    useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      // send the code to your backend
        fetch("http://localhost:5000/exchange_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        })
        .then(res => res.json())
        .then(data => {
            console.log("Access token response:", data);
          // save token in state/localStorage as needed
        })
        .catch(err => console.error("Error exchanging token:", err));
    }
    }, [searchParams]);

    return <h2>Processing Strava login…</h2>;
}

export default ExchangeToken;
