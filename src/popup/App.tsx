import * as React from 'react';
import ReactDOM from 'react-dom';
import Title from './components/title';

const Popup = () => {
  return (
    <>
      <Title/>
    </>
  );
};

ReactDOM.render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>,
    document.getElementById('root')
);
