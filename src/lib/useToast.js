import { useEffect, useState } from 'react';

/**
 * useToast — 統一管理 Toast 顯示狀態
 * 用法：const toast = useToast();
 *       toast.show('訊息');                 // 一般資訊（白底）
 *       toast.show('完成！', 'success');    // 成功（青綠底）
 *       toast.show('失敗', 'error');        // 錯誤（rose 底）
 *       <Toast message={toast.message} visible={toast.visible} variant={toast.variant} />
 */
export function useToast(duration = 2000) {
  const [message, setMessage] = useState('');
  const [variant, setVariant] = useState('info');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const tmr = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(tmr);
  }, [visible, duration]);

  function show(msg, nextVariant = 'info') {
    setMessage(msg);
    setVariant(nextVariant);
    setVisible(true);
  }

  return { message, visible, variant, show };
}
