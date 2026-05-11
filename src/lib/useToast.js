import { useEffect, useState } from 'react';

/**
 * useToast — 統一管理 Toast 顯示狀態
 * 用法：const toast = useToast();
 *       toast.show('訊息');
 *       <Toast message={toast.message} visible={toast.visible} />
 */
export function useToast(duration = 2000) {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const tmr = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(tmr);
  }, [visible, duration]);

  function show(msg) {
    setMessage(msg);
    setVisible(true);
  }

  return { message, visible, show };
}
