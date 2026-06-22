import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const JoinGame: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    navigate({
      pathname: '/',
      search: searchParams.toString(),
    }, { replace: true });
  }, [navigate, searchParams]);

  return null;
};

export default JoinGame;
