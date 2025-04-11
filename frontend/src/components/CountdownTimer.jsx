import React from 'react';

const CountdownTimer = ({ timer }) => {
  console.log('Rendering CountdownTimer with timer:', timer);
  return (
    <div className="countdown-timer">
      Next comment in: {timer}s
    </div>
  );
};

export default CountdownTimer;