/** Centralized auth header management */
export const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('nexigent_jwt_token');
  if (token) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    };
  }
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  };
};

export const isAuthenticated = () => !!localStorage.getItem('nexigent_jwt_token');

export const logout = () => {
  localStorage.removeItem('nexigent_jwt_token');
};
