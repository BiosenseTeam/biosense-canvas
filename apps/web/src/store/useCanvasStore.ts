import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DoctorPreferences {
  promptInstructions?: string;
  [key: string]: any;
}

interface PatientData {
  [key: string]: any;
}

interface UserData {
  userId: number;
  name?: string;
  email?: string;
  [key: string]: any;
}

interface CanvasState {
  doctorPreferences: DoctorPreferences | null;
  patientData: PatientData | null;
  userData: UserData | null;
  setDoctorPreferences: (preferences: DoctorPreferences) => void;
  setPatientData: (data: PatientData) => void;
  setUserData: (data: UserData) => void;
  clearData: () => void;
}

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set) => ({
      doctorPreferences: null,
      patientData: null,
      userData: null,
      setDoctorPreferences: (preferences) => set({ doctorPreferences: preferences }),
      setPatientData: (data) => set({ patientData: data }),
      setUserData: (data) => set({ userData: data }),
      clearData: () => set({ doctorPreferences: null, patientData: null, userData: null }),
    }),
    {
      name: 'canvas-store',
      // Only persist these fields
      partialize: (state) => ({
        doctorPreferences: state.doctorPreferences,
        patientData: state.patientData,
        userData: state.userData,
      }),
    }
  )
);