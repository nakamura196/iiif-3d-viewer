'use client';

import CommonLayout from '@/components/layout/Common';
import { auth, provider } from '@/lib/firebase/firebase';
import { getAuth, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { useState, useEffect } from 'react';

export default function EditorContent() {
  const [user, setUser] = useState<User | null>(null);

  const login = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  const logout = () => {
    const auth = getAuth();
    signOut(auth);
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <CommonLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 bg-white dark:bg-gray-900">
        {/* アイコンと見出し */}
        <button onClick={login}>Login</button>
        <button onClick={logout}>Logout</button>
        {/* <button onClick={getToken}>Get Token</button> */}

        {/* ログイン済みの場合 */}
        {user && <div>{user.email}</div>}
      </div>
    </CommonLayout>
  );
}