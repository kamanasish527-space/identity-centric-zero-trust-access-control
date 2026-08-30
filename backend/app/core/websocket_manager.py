import asyncio
from typing import Set

from fastapi import WebSocket


class WebSocketManager:
    def __init__(self) -> None:
        self.active_connections: Set[WebSocket] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict) -> None:
        stale: Set[WebSocket] = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                stale.add(connection)

        for connection in stale:
            self.disconnect(connection)

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop


ws_manager = WebSocketManager()


def broadcast_event(message: dict) -> None:
    try:
        running_loop = asyncio.get_running_loop()
        if running_loop.is_running():
            running_loop.create_task(ws_manager.broadcast(message))
            return
    except RuntimeError:
        pass

    if ws_manager._loop and ws_manager._loop.is_running():
        asyncio.run_coroutine_threadsafe(ws_manager.broadcast(message), ws_manager._loop)
