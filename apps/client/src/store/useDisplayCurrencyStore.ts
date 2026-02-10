import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type DisplayCurrency = 'USD' | 'BS';

interface DisplayCurrencyState {
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
  toggleDisplayCurrency: () => void;
}

const STORAGE_KEY = 'disis-display-currency';

export const useDisplayCurrencyStore = create<DisplayCurrencyState>()(
  persist(
    (set) => ({
      displayCurrency: 'USD',
      setDisplayCurrency: (currency) => set({ displayCurrency: currency }),
      toggleDisplayCurrency: () =>
        set((state) => ({
          displayCurrency: state.displayCurrency === 'USD' ? 'BS' : 'USD',
        })),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') return localStorage;
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      partialize: (state) => ({ displayCurrency: state.displayCurrency }),
    }
  )
);
