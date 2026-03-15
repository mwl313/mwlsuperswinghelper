import httpx


async def send_telegram_message(token: str | None, chat_id: str | None, message: str) -> bool:
    if not token or not chat_id:
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id, "text": message}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(url, json=payload)
            return response.status_code == 200
    except Exception:
        return False
