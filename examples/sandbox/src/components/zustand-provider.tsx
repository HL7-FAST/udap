"use client"
import { ReactNode, useEffect } from 'react';

export default function ZustandProvider(props: { children: ReactNode }) {

  useEffect(() => {
    const initializeStates = async () => {
    };
    initializeStates();
  },[]);

  return (
    <>{props.children}</>
  );
}