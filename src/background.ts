const polling = async () => {
  setTimeout(polling, 1000 * 30);
};

polling();
