import React from 'react';

const ChartCard = ({ title, description, action, children, className = '' }) => (
  <section className={`chart-card ${className}`}>
    <div className="chart-card-header">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
    <div className="chart-card-body">{children}</div>
  </section>
);

export default ChartCard;
