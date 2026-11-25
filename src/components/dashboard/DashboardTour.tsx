'use client';

import React from 'react';
import { GuidedTour } from '@/components/tour/GuidedTour';
import { PAGE_TOURS } from '@/components/tour/tour-definitions';

interface DashboardTourProps {
  onClose: () => void;
}

export default function DashboardTour({ onClose }: DashboardTourProps) {
  const config = PAGE_TOURS.dashboard;
  return (
    <GuidedTour
      tourKey={config.tourKey}
      pageTitle={config.pageTitle}
      welcomeTitle={config.welcomeTitle}
      welcomeDescription={config.welcomeDescription}
      welcomeBenefit={config.welcomeBenefit}
      steps={config.steps}
      isOpen={true}
      onClose={onClose}
      onComplete={onClose}
      startImmediately={false}
    />
  );
}
