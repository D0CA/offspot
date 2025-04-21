import { useEffect } from 'react'
import { usePlayer } from '../context/PlayerContext'
import { setupSocketHandlers } from '../socket/socketHandler'

export function useSocket(appRef, stageRef, setPlayerCount) {
  const {
    user,
    socket,
    playersRef,
    setMyXP,
    setMyLevel,
    setCurrentXP,
    setXPRequired,
    updateMyXP
  } = usePlayer()

  useEffect(() => {
    if (!user || !socket.current || !appRef?.current || !stageRef?.current) return

    setupSocketHandlers({
      socket: socket.current,
      app: appRef.current,
      playersRef,
      stage: stageRef.current,
      user,
      setMyXP,
      setMyLevel,
      setXPRequired,
      setCurrentXP,
      setPlayerCount,
      updateMyXP
    })

    return () => {
      socket.current?.removeAllListeners()
    }
  }, [user, socket.current, appRef?.current, stageRef?.current])
}
