import Sidebar from '../Sidebar/Sidebar';
import MainPane from '../MainPane/MainPane';

export default function AppBody() {
  return (
    <div className="app-body">
      <Sidebar />
      <MainPane />
    </div>
  );
}
