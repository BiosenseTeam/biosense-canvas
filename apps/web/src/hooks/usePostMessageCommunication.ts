import { useEffect } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';

interface DoctorPreferences {
  // This will be expanded based on actual preferences
  promptInstructions?: string;
  // Add other preferences as needed
}

interface PatientData {
  // This will be expanded based on actual requirements
  [key: string]: any;
}

interface UserData {
  userId: number;
  name?: string;
  email?: string;
  [key: string]: any;
}

type PostMessageData = {
  type: 'DOCTOR_PREFERENCES' | 'PATIENT_DATA' | 'USER_DATA' | 'INIT';
  data: DoctorPreferences | PatientData | UserData;
};

export function usePostMessageCommunication() {
  const { setDoctorPreferences, setPatientData, setUserData } = useCanvasStore();

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // In development, accept messages from both origins
      const allowedOrigins = process.env.NODE_ENV === 'production'
        ? ['https://your-production-app-url.com']
        : ['http://localhost:4200', 'http://localhost:3333'];

      if (!allowedOrigins.includes(event.origin)) {
        console.warn('Received message from unauthorized origin:', event.origin);
        return;
      }

      const logMessage = {
        type: 'CANVAS_LOG',
        data: {
          message: 'Canvas received message:',
          payload: event.data,
          origin: event.origin,
          timestamp: new Date().toISOString()
        }
      };

      // Send log back to parent window
      if (window.parent !== window) {
        // In development, use * to handle port differences
        const targetOrigin = process.env.NODE_ENV === 'production'
          ? 'https://your-production-app-url.com'
          : '*';
        window.parent.postMessage(logMessage, targetOrigin);
      }

      try {
        const message = event.data as PostMessageData;
        console.log('Received message:', message);

        switch (message.type) {
          case 'DOCTOR_PREFERENCES':
            setDoctorPreferences(message.data as DoctorPreferences);
            break;
          case 'PATIENT_DATA':
            setPatientData(message.data as PatientData);
            break;
          case 'USER_DATA':
          case 'INIT':
            if ('userData' in message.data) {
              setUserData(message.data.userData as UserData);
              console.log('User data stored in canvas store');
            }
            break;
          default:
            console.warn('Unknown message type:', message.type);
        }

        // Acknowledge receipt
        window.parent.postMessage({
          type: 'CANVAS_ACK',
          data: {
            receivedType: message.type,
            timestamp: new Date().toISOString()
          }
        }, '*');

      } catch (error) {
        console.error('Error processing message:', error);
        // Notify parent of error
        window.parent.postMessage({
          type: 'CANVAS_ERROR',
          data: {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          }
        }, '*');
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setDoctorPreferences, setPatientData, setUserData]);

  return useCanvasStore();
}