import React, { useState, useEffect } from 'react';

interface PdfRecord {
  id: string;
  filename: string;
  originalName: string;
  apellidoNombre: string;
  lu: string;
  codigoCarrera: string;
  plan: string;
  codigoMateria: string;
  genericaAsociada: string;
  procesado: boolean;
  createdAt: string;
}

const API_URL = '/api';

function App() {
  const [records, setRecords] = useState<PdfRecord[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PdfRecord>>({});
  const [dragOver, setDragOver] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    fetchRecords();
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const fetchRecords = async () => {
    try {
      const res = await fetch(`${API_URL}/records`);
      const data = await res.json();
      setRecords(data);
      addLog(`Cargados ${data.length} registros`);
    } catch (err) {
      console.error('Error fetching records:', err);
      addLog('Error cargando registros');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    setFiles(prev => [...prev, ...droppedFiles]);
    addLog(`Arrastrados ${droppedFiles.length} archivos`);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
      setFiles(prev => [...prev, ...selectedFiles]);
      addLog(`Seleccionados ${selectedFiles.length} archivos`);
    }
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;
    setUploading(true);
    addLog(`Subiendo ${files.length} archivos...`);

    const formData = new FormData();
    files.forEach(f => formData.append('pdfs', f));

    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      addLog(`Subidos ${result.count} archivos - OCR en proceso...`);
      
      // Wait a moment then refresh
      setTimeout(() => {
        fetchRecords().then(() => {
          addLog('Registros actualizados');
        });
      }, 2000);
      
      setFiles([]);
    } catch (err) {
      console.error('Error uploading:', err);
      addLog('Error al subir archivos');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startEdit = (record: PdfRecord) => {
    setEditingId(record.id);
    setEditForm({
      apellidoNombre: record.apellidoNombre,
      lu: record.lu,
      codigoCarrera: record.codigoCarrera,
      plan: record.plan,
      codigoMateria: record.codigoMateria,
      genericaAsociada: record.genericaAsociada,
    });
    addLog(`Editando: ${record.originalName}`);
  };

  const saveEdit = async () => {
    if (!editingId) return;

    try {
      const res = await fetch(`${API_URL}/records/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingId(null);
        fetchRecords();
        addLog('Cambios guardados');
      }
    } catch (err) {
      console.error('Error saving:', err);
      addLog('Error guardando cambios');
    }
  };

  const deleteRecord = async (id: string) => {
    if (!confirm('¿Eliminar este registro?')) return;
    try {
      await fetch(`${API_URL}/records/${id}`, { method: 'DELETE' });
      fetchRecords();
      addLog('Registro eliminado');
    } catch (err) {
      console.error('Error deleting:', err);
      addLog('Error eliminando');
    }
  };

  const deleteAll = async () => {
    try {
      for (const record of records) {
        await fetch(`${API_URL}/records/${record.id}`, { method: 'DELETE' });
      }
      fetchRecords();
      addLog('Todos los registros eliminados');
    } catch (err) {
      console.error('Error deleting all:', err);
      addLog('Error al eliminar todos');
    }
  };

  const reprocess = async (id: string) => {
    addLog(' reprocesando OCR...');
    try {
      const res = await fetch(`${API_URL}/records/${id}/reprocess`, { method: 'POST' });
      if (res.ok) {
        addLog('OCR completado');
        fetchRecords();
      }
    } catch (err) {
      addLog('Error en reprocesamiento');
    }
  };

  const exportExcel = async () => {
    try {
      const res = await fetch(`${API_URL}/export`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'inscripciones.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
      addLog('Excel exportado');
    } catch (err) {
      console.error('Error exporting:', err);
      addLog('Error exportando Excel');
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Gestión de InscripcionesPDF</h1>
      
      {/* Logs Panel */}
      {logs.length > 0 && (
        <div style={styles.logsPanel}>
          <h4>Logs:</h4>
          {logs.slice(-5).map((log, i) => (
            <div key={i} style={styles.logItem}>{log}</div>
          ))}
        </div>
      )}
      
      {/* Upload Zone */}
      <div
        style={{
          ...styles.uploadZone,
          ...(dragOver ? styles.dragOver : {}),
        }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <p>Arrastrá PDFs aquí o</p>
        <input
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileSelect}
          style={styles.fileInput}
        />
      </div>

      {/* Pending Files */}
      {files.length > 0 && (
        <div style={styles.pendingSection}>
          <h3>Archivos pendientes ({files.length})</h3>
          <div style={styles.fileList}>
            {files.map((file, i) => (
              <div key={i} style={styles.fileItem}>
                <span>{file.name}</span>
                <button onClick={() => removeFile(i)} style={styles.removeBtn}>✕</button>
              </div>
            ))}
          </div>
          <button
            onClick={uploadFiles}
            disabled={uploading}
            style={styles.uploadBtn}
          >
            {uploading ? 'Subiendo y procesando...' : 'Subir PDFs'}
          </button>
        </div>
      )}

      {/* Records Table */}
      <div style={styles.tableSection}>
        <div style={styles.tableHeader}>
          <h3>Archivos subidos ({records.length})</h3>
          <button onClick={exportExcel} style={styles.exportBtn}>
            Exportar Excel
          </button>
          <button onClick={() => {
            if (confirm('¿Eliminar TODOS los registros?')) {
              deleteAll();
            }
          }} style={styles.deleteAllBtn}>
            Borrar Todos
          </button>
        </div>
        
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Apellido y Nombre</th>
                <th>LU</th>
                <th>Código Carrera</th>
                <th>Plan</th>
                <th>Código Materia</th>
                <th>Genérica Asociada</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.id}>
                  <td title={record.originalName} style={styles.filenameCell}>
                    {record.originalName}
                  </td>
                  {editingId === record.id ? (
                    <>
                      <td><input value={editForm.apellidoNombre || ''} onChange={e => setEditForm({...editForm, apellidoNombre: e.target.value})} style={styles.input} /></td>
                      <td><input value={editForm.lu || ''} onChange={e => setEditForm({...editForm, lu: e.target.value})} style={styles.input} /></td>
                      <td><input value={editForm.codigoCarrera || ''} onChange={e => setEditForm({...editForm, codigoCarrera: e.target.value})} style={styles.input} /></td>
                      <td><input value={editForm.plan || ''} onChange={e => setEditForm({...editForm, plan: e.target.value})} style={styles.input} /></td>
                      <td><input value={editForm.codigoMateria || ''} onChange={e => setEditForm({...editForm, codigoMateria: e.target.value})} style={styles.input} /></td>
                      <td><input value={editForm.genericaAsociada || ''} onChange={e => setEditForm({...editForm, genericaAsociada: e.target.value})} style={styles.input} /></td>
                      <td>
                        <button onClick={saveEdit} style={styles.saveBtn}>Guardar</button>
                        <button onClick={() => setEditingId(null)} style={styles.cancelBtn}>Cancelar</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{record.apellidoNombre || '-'}</td>
                      <td>{record.lu || '-'}</td>
                      <td>{record.codigoCarrera || '-'}</td>
                      <td>{record.plan || '-'}</td>
                      <td>{record.codigoMateria || '-'}</td>
                      <td>{record.genericaAsociada || '-'}</td>
                      <td>
                        <button onClick={() => startEdit(record)} style={styles.editBtn}>Editar</button>
                        <button onClick={() => reprocess(record.id)} style={styles.reprocessBtn}>OCR</button>
                        <button onClick={() => deleteRecord(record.id)} style={styles.delBtn}>Eliminar</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  title: {
    marginBottom: '20px',
    color: '#333',
  },
  logsPanel: {
    backgroundColor: '#1e1e1e',
    color: '#00ff00',
    padding: '10px',
    borderRadius: '5px',
    marginBottom: '15px',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  logItem: {
    marginBottom: '2px',
  },
  uploadZone: {
    border: '3px dashed #ccc',
    borderRadius: '10px',
    padding: '40px',
    textAlign: 'center',
    marginBottom: '20px',
    backgroundColor: '#f9f9f9',
  },
  dragOver: {
    borderColor: '#007bff',
    backgroundColor: '#e6f2ff',
  },
  fileInput: {
    marginTop: '10px',
  },
  pendingSection: {
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: '#fff3cd',
    borderRadius: '5px',
  },
  fileList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '10px',
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 10px',
    backgroundColor: '#fff',
    borderRadius: '5px',
    border: '1px solid #ddd',
  },
  removeBtn: {
    background: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    padding: '2px 6px',
  },
  uploadBtn: {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  tableSection: {
    marginTop: '20px',
  },
  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  exportBtn: {
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '5px',
    cursor: 'pointer',
    marginLeft: '10px',
  },
  deleteAllBtn: {
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  filenameCell: {
    maxWidth: '150px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  input: {
    width: '100px',
    padding: '5px',
  },
  editBtn: {
    backgroundColor: '#ffc107',
    border: 'none',
    padding: '5px 10px',
    borderRadius: '3px',
    cursor: 'pointer',
    marginRight: '5px',
  },
  reprocessBtn: {
    backgroundColor: '#17a2b8',
    color: 'white',
    border: 'none',
    padding: '5px 10px',
    borderRadius: '3px',
    cursor: 'pointer',
    marginRight: '5px',
  },
  delBtn: {
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    padding: '5px 10px',
    borderRadius: '3px',
    cursor: 'pointer',
  },
  saveBtn: {
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    padding: '5px 10px',
    borderRadius: '3px',
    cursor: 'pointer',
    marginRight: '5px',
  },
  cancelBtn: {
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    padding: '5px 10px',
    borderRadius: '3px',
    cursor: 'pointer',
  },
};

export default App;