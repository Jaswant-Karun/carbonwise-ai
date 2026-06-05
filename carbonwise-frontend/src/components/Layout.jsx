import React from 'react';
import Sidebar from './Sidebar';
//Added new Activity
const Layout = ({ children }) => {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
};

export default Layout;
