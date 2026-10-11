import React from 'react';

const SummaryCard = ({ label, value, detail, icon: Icon, tone = 'green' }) => (
  <article className={`summary-card summary-card-${tone}`}>
    <div className="summary-card-top">
      <span className="summary-label">{label}</span>
      {Icon ? (
        <span className="summary-icon">
          <Icon size={18} aria-hidden="true" />
        </span>
      ) : null}
    </div>
    <strong className="summary-value">{value}</strong>
    {detail ? <span className="summary-detail">{detail}</span> : null}
  </article>
);

export default SummaryCard;
