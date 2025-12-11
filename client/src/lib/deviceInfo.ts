export interface DeviceInfo {
  sessionId: string;
  deviceType: 'Mobile' | 'Tablet' | 'Desktop';
  browserName: string;
  userAgent: string;
}

let sessionId: string | null = null;

function generateSessionId(): string {
  return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

export function getSessionId(): string {
  if (!sessionId) {
    const stored = sessionStorage.getItem('notesmate_session_id');
    if (stored) {
      sessionId = stored;
    } else {
      sessionId = generateSessionId();
      sessionStorage.setItem('notesmate_session_id', sessionId);
    }
  }
  return sessionId;
}

export function getDeviceType(): 'Mobile' | 'Tablet' | 'Desktop' {
  const ua = navigator.userAgent.toLowerCase();
  
  const isMobile = /iphone|ipod|android.*mobile|windows phone|blackberry|bb10/i.test(ua);
  const isTablet = /ipad|android(?!.*mobile)|tablet|kindle|silk/i.test(ua);
  
  if (isMobile) return 'Mobile';
  if (isTablet) return 'Tablet';
  return 'Desktop';
}

export function getBrowserName(): string {
  const ua = navigator.userAgent;
  
  if (ua.includes('Firefox/')) {
    const match = ua.match(/Firefox\/(\d+)/);
    return match ? `Firefox ${match[1]}` : 'Firefox';
  }
  
  if (ua.includes('Edg/')) {
    const match = ua.match(/Edg\/(\d+)/);
    return match ? `Edge ${match[1]}` : 'Edge';
  }
  
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    const match = ua.match(/Chrome\/(\d+)/);
    return match ? `Chrome ${match[1]}` : 'Chrome';
  }
  
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    const match = ua.match(/Version\/(\d+)/);
    return match ? `Safari ${match[1]}` : 'Safari';
  }
  
  if (ua.includes('Opera/') || ua.includes('OPR/')) {
    const match = ua.match(/(?:Opera|OPR)\/(\d+)/);
    return match ? `Opera ${match[1]}` : 'Opera';
  }
  
  return 'Unknown Browser';
}

export function getDeviceInfo(): DeviceInfo {
  return {
    sessionId: getSessionId(),
    deviceType: getDeviceType(),
    browserName: getBrowserName(),
    userAgent: navigator.userAgent,
  };
}
