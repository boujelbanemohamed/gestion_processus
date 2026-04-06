import { useEffect, useState } from 'react';
import { api } from '../services/api';

type TabType = 'categories' | 'smtp' | 'typesSociete' | 'typesLicence' | 'devises' | 'notifications';


function NotificationsTab() {
  const [openTemplate, setOpenTemplate] = useState<string | null>(null);
  const [testEmailMap, setTestEmailMap] = useState<Record<string, string>>({});
  const [testingMap, setTestingMap] = useState<Record<string, boolean>>({});
  const [testResultMap, setTestResultMap] = useState<Record<string, {success: boolean, message: string} | null>>({});

  const sendTestNotification = async (n: any) => {
    const email = testEmailMap[n.id];
    if (!email) return;
    setTestingMap(prev => ({ ...prev, [n.id]: true }));
    setTestResultMap(prev => ({ ...prev, [n.id]: null }));
    try {
      const res = await api.post('/smtp/test-notification', {
        notificationId: n.id, testEmail: email, sujet: n.sujet, template: n.template,
      });
      setTestResultMap(prev => ({ ...prev, [n.id]: { success: true, message: res.data.message } }));
    } catch (e: any) {
      setTestResultMap(prev => ({ ...prev, [n.id]: { success: false, message: e?.response?.data?.error || 'Erreur envoi' } }));
    }
    setTestingMap(prev => ({ ...prev, [n.id]: false }));
  };

  const notifications = [
    { id: 'mention', icon: '📌', pages: ['Tâches', 'Epics', 'User stories', 'Processus', 'Projets', 'Documents', 'Contrats'], titre: 'Mention dans un commentaire', description: 'Envoye lorsque un utilisateur est mentionne via @Prenom Nom dans un commentaire sur une tache, un epic ou une user story.', destinataire: 'La personne mentionnee', declencheur: 'Ajout commentaire avec @mention', sujet: 'Mention (tache / epic / user story) : [Titre]', template: `Bonjour [Prenom Nom],

[Auteur] vous a mentionne dans un commentaire (tache, epic ou user story) :

[Titre]

"[Contenu du commentaire]"

PMO Hub` },
    { id: 'assignation', icon: '✅', pages: ['Tâches', 'Projets'], titre: 'Assignation a une tache', description: 'Envoye lorsque un utilisateur est assigne a une tache.', destinataire: 'Utilisateur assigne', declencheur: 'Creation ou modification avec assignation', sujet: 'Nouvelle assignation : [Nom tache]', template: `Bonjour [Prenom Nom],

[Auteur] vous a assigne a la tache :

[Nom de la tache]

PMO Hub` },
    { id: 'statut', icon: '🔄', pages: ['Tâches', 'Processus', 'Projets'], titre: 'Changement de statut', description: 'Envoye lorsque le statut est modifie.', destinataire: 'Createur et utilisateurs assignes', declencheur: 'Modification du statut', sujet: 'Statut modifie : [Nom tache]', template: `Bonjour [Prenom Nom],

[Auteur] a modifie le statut de [Nom tache] :

[Ancien statut] => [Nouveau statut]

PMO Hub` },
    { id: 'retard', icon: '⚠️', pages: ['Tâches', 'Projets'], titre: 'Tache en retard', description: 'Envoye chaque matin a 8h pour les taches dont la date de fin est depassee.', destinataire: 'Createur et utilisateurs assignes', declencheur: 'Job automatique a 8h00', sujet: 'Tache en retard : [Nom tache]', template: `Bonjour [Prenom Nom],

La tache suivante est en retard de [N] jour(s) :

[Nom de la tache]

PMO Hub` },
    { id: 'nouvelle_tache', icon: '📋', pages: ['Tâches', 'Projets'], titre: 'Nouvelle tache liee a un projet', description: 'Envoye aux membres du projet lorsque une nouvelle tache y est liee.', destinataire: 'Membres du projet', declencheur: 'Creation tache avec projet associe', sujet: 'Nouvelle tache dans [Nom projet]', template: `Bonjour [Prenom Nom],

[Auteur] a cree une nouvelle tache dans [Nom projet] :

[Nom de la tache]

PMO Hub` },
    { id: 'commentaire', icon: '💬', pages: ['Tâches', 'Epics', 'User stories', 'Processus', 'Projets', 'Documents'], titre: 'Nouveau commentaire (tache)', description: 'Envoye lorsque un commentaire est ajoute sur une tache.', destinataire: 'Createur et assignes (hors auteur)', declencheur: 'Ajout commentaire sur une tache', sujet: 'Nouveau commentaire : [Nom tache]', template: `Bonjour [Prenom Nom],

[Auteur] a commente la tache [Nom tache] :

"[Contenu]"

PMO Hub` },
    { id: 'commentaire_epic', icon: '💬', pages: ['Tâches', 'Epics'], titre: 'Nouveau commentaire sur un epic', description: 'Envoye au createur de l epic et aux createurs / assignes des taches rattachees aux user stories de l epic (hors auteur).', destinataire: 'Createur epic + parties prenantes des taches liees', declencheur: 'Ajout commentaire sur un epic', sujet: 'Nouveau commentaire : [Nom epic]', template: `Bonjour [Prenom Nom],

[Auteur] a commente l epic [Nom epic] :

"[Contenu]"

PMO Hub` },
    { id: 'commentaire_user_story', icon: '💬', pages: ['Tâches', 'User stories'], titre: 'Nouveau commentaire sur une user story', description: 'Envoye aux createurs et assignes des taches liees a la user story (hors auteur).', destinataire: 'Createurs et assignes des taches liees', declencheur: 'Ajout commentaire sur une user story', sujet: 'Nouveau commentaire : [User story]', template: `Bonjour [Prenom Nom],

[Auteur] a commente la user story [Extrait description] :

"[Contenu]"

PMO Hub` },
    { id: 'document', icon: '📎', pages: ['Documents', 'Tâches', 'Processus', 'Projets', 'Contrats'], titre: 'Document uploade', description: 'Envoye lorsque un document est uploade sur une tache.', destinataire: 'Createur et assignes (hors auteur)', declencheur: 'Upload document sur une tache', sujet: 'Nouveau document : [Nom tache]', template: `Bonjour [Prenom Nom],

[Auteur] a uploade un document sur [Nom tache] :

[Nom du document]

PMO Hub` },
    { id: 'commentaire_pv', icon: '💬', pages: ['PV de réunion'], titre: 'Commentaire sur un PV de réunion', description: 'Envoye lorsque un commentaire est ajoute sur un PV. Si le commentaire est assigne a un utilisateur, seul celui-ci est notifie ; sinon le createur du PV et les delegues modification.', destinataire: 'Assigne (prioritaire) ou createur + delegues', declencheur: 'Ajout commentaire sur un PV', sujet: 'Commentaire sur PV : [Titre PV]', template: `Bonjour [Prenom Nom],

[Auteur] a commente le PV [Titre PV] :

"[Contenu]"

[Si piece jointe : mention de l annexe]

PMO Hub` },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-2">Notifications par email</h2>
        <p className="text-sm text-gray-500 mb-6">Liste des notifications automatiques envoyees par application.</p>
        <div className="space-y-3">
          {notifications.map(n => (
            <div key={n.id} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-start gap-4 p-4 hover:bg-gray-50">
                <div className="text-2xl shrink-0">{n.icon}</div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-800 mb-1">{n.titre}</h3>
                  <p className="text-sm text-gray-600 mb-2">{n.description}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-2">
                    <span>Destinataire : {n.destinataire}</span>
                    <span>Declencheur : {n.declencheur}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-xs text-gray-400 font-medium mr-1">Pages concernées :</span>
                    {(n as any).pages?.map((p: string) => (
                      <span key={p} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium border border-indigo-100">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Actif</span>
                  <button onClick={() => setOpenTemplate(openTemplate === n.id ? null : n.id)} className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-600">
                    {openTemplate === n.id ? 'Masquer' : 'Voir template'}
                  </button>
                </div>
              </div>
              {openTemplate === n.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-2xl">
                    <div className="bg-blue-600 text-white px-4 py-3">
                      <p className="text-xs font-medium opacity-75 mb-1">Sujet :</p>
                      <p className="text-sm font-semibold">{n.sujet}</p>
                    </div>
                    <div className="p-4">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{n.template}</pre>
                      <p className="text-xs text-gray-400 mt-3">PMO Hub — Notification automatique</p>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 max-w-2xl mt-3">
                    <p className="text-sm font-semibold text-gray-700 mb-3">📧 Tester l'envoi de cette notification</p>
                    <div className="flex gap-2 mb-2">
                      <input type="email" placeholder="Entrez votre adresse email..."
                        value={testEmailMap[n.id] || ''}
                        onChange={e => setTestEmailMap(prev => ({ ...prev, [n.id]: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      <button onClick={() => sendTestNotification(n)}
                        disabled={testingMap[n.id] || !testEmailMap[n.id]}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                        {testingMap[n.id] ? '⏳ Envoi...' : '📤 Envoyer le test'}
                      </button>
                    </div>
                    {testResultMap[n.id] && (
                      <div className={`px-3 py-2 rounded text-sm ${testResultMap[n.id]!.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {testResultMap[n.id]!.success ? '✅ ' : '❌ '}{testResultMap[n.id]!.message}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Les valeurs entre [crochets] sont remplacees automatiquement.</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">Les notifications par email necessitent une configuration SMTP active.</p>
        </div>
      </div>
    </div>
  );
}

export default function Configuration() {
  const [activeTab, setActiveTab] = useState<TabType>('categories');
  
  // Catégories
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    couleur: '#3B82F6',
    icone: '',
    parentId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // SMTP
  const [smtpConfigs, setSmtpConfigs] = useState<any[]>([]);
  const [smtpLoading, setSmtpLoading] = useState(true);
  const [typesSocieteList, setTypesSocieteList] = useState<any[]>([]);
  const [tsLoading, setTsLoading] = useState(false);
  const [showTsModal, setShowTsModal] = useState(false);
  const [editingTs, setEditingTs] = useState<any>(null);
  const [tsForm, setTsForm] = useState({ nom: '', description: '' });
  const [typesLicenceList, setTypesLicenceList] = useState<any[]>([]);
  const [tlLoading, setTlLoading] = useState(false);
  const [showTlModal, setShowTlModal] = useState(false);
  const [editingTl, setEditingTl] = useState<any>(null);
  const [tlForm, setTlForm] = useState({ nom: '' });
  const [devisesList, setDevisesList] = useState<any[]>([]);
  const [devLoading, setDevLoading] = useState(false);
  const [showDevModal, setShowDevModal] = useState(false);
  const [editingDev, setEditingDev] = useState<any>(null);
  const [devForm, setDevForm] = useState({ code: '', libelle: '' });
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  const [editingSmtp, setEditingSmtp] = useState<any>(null);
  const [smtpFormData, setSmtpFormData] = useState({
    host: '',
    port: 587,
    secure: false,
    user: '',
    password: '',
    fromEmail: '',
    fromName: '',
    isActive: false,
  });
  const [smtpSubmitting, setSmtpSubmitting] = useState(false);
  const [smtpError, setSmtpError] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    if (activeTab === 'categories') {
      loadCategories();
    } else if (activeTab === 'typesSociete') {
      loadTypesSociete();
    } else if (activeTab === 'typesLicence') {
      loadTypesLicence();
    } else if (activeTab === 'devises') {
      loadDevises();
    } else if (activeTab === 'smtp') {
      loadSmtpConfigs();
    }
  }, [activeTab]);

  const loadTypesSociete = async () => {
    setTsLoading(true);
    try { const r = await api.get("/types-societe"); setTypesSocieteList(r.data); } catch(e) { console.error(e); }
    setTsLoading(false);
  };
  const handleSaveTs = async () => {
    try {
      if (editingTs) await api.put(`/types-societe/${editingTs.id}`, tsForm);
      else await api.post("/types-societe", tsForm);
      setShowTsModal(false); setEditingTs(null); setTsForm({ nom: "", description: "" }); loadTypesSociete();
    } catch(e) { alert("Erreur"); }
  };
  const handleDeleteTs = async (id: string, nom: string) => {
    if (!confirm(`Supprimer "${nom}" ?`)) return;
    await api.delete(`/types-societe/${id}`); loadTypesSociete();
  };

  const loadTypesLicence = async () => {
    setTlLoading(true);
    try {
      const r = await api.get('/types-licence');
      setTypesLicenceList(r.data);
    } catch (e) {
      console.error(e);
    }
    setTlLoading(false);
  };
  const handleSaveTl = async () => {
    try {
      if (editingTl) await api.put(`/types-licence/${editingTl.id}`, tlForm);
      else await api.post('/types-licence', tlForm);
      setShowTlModal(false);
      setEditingTl(null);
      setTlForm({ nom: '' });
      loadTypesLicence();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Erreur');
    }
  };
  const handleDeleteTl = async (id: string, nom: string) => {
    if (!confirm(`Supprimer le type de licence « ${nom} » ?`)) return;
    try {
      await api.delete(`/types-licence/${id}`);
      loadTypesLicence();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Erreur');
    }
  };

  const loadDevises = async () => {
    setDevLoading(true);
    try {
      const r = await api.get('/devises');
      setDevisesList(r.data);
    } catch (e) {
      console.error(e);
    }
    setDevLoading(false);
  };
  const handleSaveDev = async () => {
    try {
      const payload = { code: devForm.code, libelle: devForm.libelle || null };
      if (editingDev) await api.put(`/devises/${editingDev.id}`, payload);
      else await api.post('/devises', payload);
      setShowDevModal(false);
      setEditingDev(null);
      setDevForm({ code: '', libelle: '' });
      loadDevises();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Erreur');
    }
  };
  const handleDeleteDev = async (id: string, code: string) => {
    if (!confirm(`Supprimer la devise « ${code} » ?`)) return;
    try {
      await api.delete(`/devises/${id}`);
      loadDevises();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Erreur');
    }
  };

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (!formData.nom.trim()) {
        setError('Le nom est obligatoire');
        return;
      }

      const submitData = {
        ...formData,
        parentId: formData.parentId || undefined,
        description: formData.description || undefined,
        icone: formData.icone || undefined,
      };

      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, submitData);
      } else {
        await api.post('/categories', submitData);
      }

      setShowModal(false);
      setEditingCategory(null);
      setFormData({
        nom: '',
        description: '',
        couleur: '#3B82F6',
        icone: '',
        parentId: '',
      });
      loadCategories();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de l\'opération');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (category: any) => {
    setEditingCategory(category);
    setFormData({
      nom: category.nom || '',
      description: category.description || '',
      couleur: category.couleur || '#3B82F6',
      icone: category.icone || '',
      parentId: category.parentId || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) {
      return;
    }

    setDeletingId(id);
    try {
      await api.delete(`/categories/${id}`);
      loadCategories();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({
      nom: '',
      description: '',
      couleur: '#3B82F6',
      icone: '',
      parentId: '',
    });
    setError('');
  };

  const loadSmtpConfigs = async () => {
    try {
      setSmtpLoading(true);
      const response = await api.get('/smtp');
      setSmtpConfigs(response.data);
    } catch (error) {
      console.error('Erreur chargement configs SMTP:', error);
    } finally {
      setSmtpLoading(false);
    }
  };

  const handleSmtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmtpError('');
    setSmtpSubmitting(true);

    try {
      const submitData = {
        ...smtpFormData,
        port: parseInt(smtpFormData.port.toString()),
        fromName: smtpFormData.fromName || undefined,
      };

      if (editingSmtp) {
        await api.put(`/smtp/${editingSmtp.id}`, submitData);
      } else {
        await api.post('/smtp', submitData);
      }

      setShowSmtpModal(false);
      setEditingSmtp(null);
      setSmtpFormData({
        host: '',
        port: 587,
        secure: false,
        user: '',
        password: '',
        fromEmail: '',
        fromName: '',
        isActive: false,
      });
      loadSmtpConfigs();
    } catch (err: any) {
      setSmtpError(err.response?.data?.error || 'Erreur lors de l\'opération');
    } finally {
      setSmtpSubmitting(false);
    }
  };

  const handleEditSmtp = (config: any) => {
    setEditingSmtp(config);
    setSmtpFormData({
      host: config.host || '',
      port: config.port || 587,
      secure: config.secure || false,
      user: config.user || '',
      password: '', // Ne pas pré-remplir le mot de passe
      fromEmail: config.fromEmail || '',
      fromName: config.fromName || '',
      isActive: config.isActive || false,
    });
    setShowSmtpModal(true);
  };

  const handleDeleteSmtp = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette configuration SMTP ?')) {
      return;
    }

    try {
      await api.delete(`/smtp/${id}`);
      loadSmtpConfigs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  const handleTestSmtp = async (id: string) => {
    if (!testEmail.trim()) {
      alert('Veuillez saisir un email de test');
      return;
    }

    setTestingId(id);
    try {
      const response = await api.post(`/smtp/${id}/test`, { testEmail });
      alert(response.data.message || 'Test réussi !');
      loadSmtpConfigs(); // Recharger pour afficher le résultat du test
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors du test');
      loadSmtpConfigs(); // Recharger même en cas d'erreur pour afficher le résultat
    } finally {
      setTestingId(null);
      setTestEmail('');
    }
  };

  if (loading && activeTab === 'categories') return <div className="p-6">Chargement...</div>;
  if (smtpLoading && activeTab === 'smtp') return <div className="p-6">Chargement...</div>;

  // Organiser les catégories en arbre (catégories racines avec leurs enfants)
  const rootCategories = categories.filter((cat) => !cat.parentId);
  const getChildren = (parentId: string) => {
    return categories.filter((cat) => cat.parentId === parentId);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Configuration</h1>

      {/* Onglets (défilement horizontal si la fenêtre est étroite) */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <nav className="-mb-px flex space-x-8 w-max min-w-full">
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'categories'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Catégories
          </button>
          <button
            onClick={() => setActiveTab('smtp')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'smtp'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Configuration SMTP
          </button>
          <button
            onClick={() => setActiveTab('typesSociete')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'typesSociete'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Types de société
          </button>
          <button
            onClick={() => setActiveTab('typesLicence')}
            className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'typesLicence'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Types de licence
          </button>
          <button
            onClick={() => setActiveTab('devises')}
            className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'devises'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Devises
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'notifications'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            🔔 Notifications
          </button>
        </nav>
      </div>

      {/* Contenu Catégories */}
      {activeTab === 'categories' && (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Catégories de processus</h2>
            <button
              onClick={() => {
                setEditingCategory(null);
                setFormData({
                  nom: '',
                  description: '',
                  couleur: '#3B82F6',
                  icone: '',
                  parentId: '',
                });
                setShowModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Ajouter une catégorie
            </button>
          </div>

      {/* Modal de création/édition */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 my-auto">
            <div className="p-6 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">
                  {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
                </h2>
                <button
                  onClick={handleCancel}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nom de la catégorie"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Description de la catégorie"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Couleur
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={formData.couleur}
                        onChange={(e) => setFormData({ ...formData, couleur: e.target.value })}
                        className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.couleur}
                        onChange={(e) => setFormData({ ...formData, couleur: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="#3B82F6"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Icône
                    </label>
                    <input
                      type="text"
                      value={formData.icone}
                      onChange={(e) => setFormData({ ...formData, icone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="ex: 📁, 📄, 📋"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catégorie parente
                  </label>
                  <select
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Aucune (catégorie racine)</option>
                    {categories
                      .filter((cat) => !editingCategory || cat.id !== editingCategory.id)
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.nom}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? 'Enregistrement...' : editingCategory ? 'Modifier' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Liste des catégories */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {categories.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Aucune catégorie. Cliquez sur "Ajouter une catégorie" pour commencer.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {rootCategories.map((category) => (
              <div key={category.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                      style={{ backgroundColor: category.couleur || '#3B82F6', color: 'white' }}
                    >
                      {category.icone || '📁'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">{category.nom}</h3>
                        {category._count && category._count.processus > 0 && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {category._count.processus} processus
                          </span>
                        )}
                      </div>
                      {category.description && (
                        <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                      )}
                      {category.couleur && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-500">Couleur:</span>
                          <div
                            className="w-6 h-6 rounded border border-gray-300"
                            style={{ backgroundColor: category.couleur }}
                          />
                          <span className="text-xs text-gray-500">{category.couleur}</span>
                        </div>
                      )}
                      {/* Afficher les sous-catégories */}
                      {getChildren(category.id).length > 0 && (
                        <div className="mt-3 ml-6 pl-4 border-l-2 border-gray-200">
                          <p className="text-xs text-gray-500 mb-2">Sous-catégories:</p>
                          {getChildren(category.id).map((child) => (
                            <div key={child.id} className="mb-2 flex items-center justify-between group">
                              <div className="flex items-center gap-2 flex-1">
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                                  style={{ backgroundColor: child.couleur || '#3B82F6', color: 'white' }}
                                >
                                  {child.icone || '📁'}
                                </div>
                                <div>
                                  <span className="text-sm text-gray-700">{child.nom}</span>
                                  {child.description && (
                                    <p className="text-xs text-gray-500">{child.description}</p>
                                  )}
                                </div>
                                {child._count && child._count.processus > 0 && (
                                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    {child._count.processus} processus
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleEdit(child)}
                                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                >
                                  Modifier
                                </button>
                                <button
                                  onClick={() => handleDelete(child.id)}
                                  disabled={deletingId === child.id}
                                  className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                                >
                                  {deletingId === child.id ? '...' : 'Supprimer'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(category)}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      disabled={deletingId === category.id}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                    >
                      {deletingId === category.id ? 'Suppression...' : 'Supprimer'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}

      {/* Contenu SMTP */}
      {activeTab === 'smtp' && (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Configurations SMTP</h2>
            <button
              onClick={() => {
                setEditingSmtp(null);
                setSmtpFormData({
                  host: '',
                  port: 587,
                  secure: false,
                  user: '',
                  password: '',
                  fromEmail: '',
                  fromName: '',
                  isActive: false,
                });
                setShowSmtpModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Nouvelle configuration SMTP
            </button>
          </div>

          {/* Modal de création/édition SMTP */}
          {showSmtpModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 my-auto">
                <div className="p-6 max-h-[85vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">
                      {editingSmtp ? 'Modifier la configuration SMTP' : 'Nouvelle configuration SMTP'}
                    </h2>
                    <button
                      onClick={() => {
                        setShowSmtpModal(false);
                        setEditingSmtp(null);
                        setSmtpFormData({
                          host: '',
                          port: 587,
                          secure: false,
                          user: '',
                          password: '',
                          fromEmail: '',
                          fromName: '',
                          isActive: false,
                        });
                        setSmtpError('');
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>

                  {smtpError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                      {smtpError}
                    </div>
                  )}

                  <form onSubmit={handleSmtpSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Serveur SMTP (host) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={smtpFormData.host}
                          onChange={(e) => setSmtpFormData({ ...smtpFormData, host: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="smtp.example.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Port <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          required
                          value={smtpFormData.port}
                          onChange={(e) => setSmtpFormData({ ...smtpFormData, port: parseInt(e.target.value) || 587 })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="587"
                        />
                      </div>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={smtpFormData.secure}
                        onChange={(e) => setSmtpFormData({ ...smtpFormData, secure: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm text-gray-700">
                        Connexion sécurisée (SSL/TLS) - généralement pour le port 465
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Utilisateur <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={smtpFormData.user}
                          onChange={(e) => setSmtpFormData({ ...smtpFormData, user: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="user@example.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Mot de passe <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          required={!editingSmtp}
                          value={smtpFormData.password}
                          onChange={(e) => setSmtpFormData({ ...smtpFormData, password: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder={editingSmtp ? 'Laisser vide pour ne pas modifier' : 'Mot de passe'}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email expéditeur <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={smtpFormData.fromEmail}
                          onChange={(e) => setSmtpFormData({ ...smtpFormData, fromEmail: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="noreply@example.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nom expéditeur
                        </label>
                        <input
                          type="text"
                          value={smtpFormData.fromName}
                          onChange={(e) => setSmtpFormData({ ...smtpFormData, fromName: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Nom de l'expéditeur"
                        />
                      </div>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={smtpFormData.isActive}
                        onChange={(e) => setSmtpFormData({ ...smtpFormData, isActive: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm text-gray-700">
                        Activer cette configuration (désactivera automatiquement les autres)
                      </label>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowSmtpModal(false);
                          setEditingSmtp(null);
                          setSmtpFormData({
                            host: '',
                            port: 587,
                            secure: false,
                            user: '',
                            password: '',
                            fromEmail: '',
                            fromName: '',
                            isActive: false,
                          });
                          setSmtpError('');
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={smtpSubmitting}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {smtpSubmitting ? 'Enregistrement...' : editingSmtp ? 'Modifier' : 'Créer'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Liste des configurations SMTP */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {smtpConfigs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucune configuration SMTP. Cliquez sur "Nouvelle configuration SMTP" pour commencer.
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {smtpConfigs.map((config) => (
                  <div key={config.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{config.host}:{config.port}</h3>
                          {config.isActive && (
                            <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded">
                              Active
                            </span>
                          )}
                          {config.secure && (
                            <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded">
                              SSL/TLS
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Utilisateur:</span> {config.user}
                          </div>
                          <div>
                            <span className="font-medium">Email expéditeur:</span> {config.fromEmail}
                          </div>
                          {config.fromName && (
                            <div>
                              <span className="font-medium">Nom expéditeur:</span> {config.fromName}
                            </div>
                          )}
                          {config.updatedBy && (
                            <div>
                              <span className="font-medium">Modifié par:</span> {config.updatedBy.prenom} {config.updatedBy.nom}
                            </div>
                          )}
                        </div>
                        {config.lastTestResult && (
                          <div className="mt-2">
                            <div className={`text-sm ${
                              config.lastTestResult.success ? 'text-green-600' : 'text-red-600'
                            }`}>
                              <span className="font-medium">Dernier test:</span>{' '}
                              {config.lastTestAt ? new Date(config.lastTestAt).toLocaleString('fr-FR') : 'N/A'} -{' '}
                              {config.lastTestResult.success 
                                ? config.lastTestResult.message || 'Succès'
                                : config.lastTestResult.error || 'Échec'}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <div className="flex flex-col gap-2">
                          <input
                            type="email"
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            placeholder="Email de test"
                            className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            onClick={() => handleTestSmtp(config.id)}
                            disabled={testingId === config.id || !testEmail.trim()}
                            className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {testingId === config.id ? 'Test en cours...' : 'Tester'}
                          </button>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => handleEditSmtp(config)}
                            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDeleteSmtp(config.id)}
                            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      {activeTab === 'typesSociete' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Types de société</h2>
            <button onClick={() => { setEditingTs(null); setTsForm({ nom: '', description: '' }); setShowTsModal(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">+ Ajouter</button>
          </div>
          {tsLoading ? <div className="text-gray-400">Chargement...</div> : (
            <div className="space-y-2">
              {typesSocieteList.length === 0 && <div className="text-gray-400 text-sm">Aucun type de société défini</div>}
              {typesSocieteList.map(ts => (
                <div key={ts.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3">
                  <div>
                    <span className="font-medium text-gray-900">{ts.nom}</span>
                    {ts.description && <span className="ml-3 text-sm text-gray-500">{ts.description}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingTs(ts); setTsForm({ nom: ts.nom, description: ts.description || '' }); setShowTsModal(true); }} className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">✏️ Modifier</button>
                    <button onClick={() => handleDeleteTs(ts.id, ts.nom)} className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">🗑 Supprimer</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {showTsModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">{editingTs ? '✏️ Modifier' : '+ Ajouter'} un type de société</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                    <input type="text" value={tsForm.nom} onChange={e => setTsForm({...tsForm, nom: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="Ex: SARL, SA, SAS..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input type="text" value={tsForm.description} onChange={e => setTsForm({...tsForm, description: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setShowTsModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Annuler</button>
                  <button onClick={handleSaveTs} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Enregistrer</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'typesLicence' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Types de licence</h2>
            <button
              onClick={() => {
                setEditingTl(null);
                setTlForm({ nom: '' });
                setShowTlModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              + Ajouter
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Ces types apparaissent dans le formulaire des licences (liste déroulante).
          </p>
          {tlLoading ? (
            <div className="text-gray-400">Chargement...</div>
          ) : (
            <div className="space-y-2">
              {typesLicenceList.length === 0 && (
                <div className="text-gray-400 text-sm">Aucun type de licence défini</div>
              )}
              {typesLicenceList.map((tl) => (
                <div
                  key={tl.id}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3"
                >
                  <span className="font-medium text-gray-900">{tl.nom}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingTl(tl);
                        setTlForm({ nom: tl.nom });
                        setShowTlModal(true);
                      }}
                      className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      ✏️ Modifier
                    </button>
                    <button
                      onClick={() => handleDeleteTl(tl.id, tl.nom)}
                      className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      🗑 Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {showTlModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">
                  {editingTl ? '✏️ Modifier' : '+ Ajouter'} un type de licence
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                    <input
                      type="text"
                      value={tlForm.nom}
                      onChange={(e) => setTlForm({ ...tlForm, nom: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="Ex. Standard, SaaS, Cloud..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setShowTlModal(false)}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSaveTl}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'devises' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Devises</h2>
            <button
              onClick={() => {
                setEditingDev(null);
                setDevForm({ code: '', libelle: '' });
                setShowDevModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              + Ajouter
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Codes utilisés dans le formulaire des licences (liste à côté du coût). Le code est normalisé en majuscules (ex. TND, EUR).
          </p>
          {devLoading ? (
            <div className="text-gray-400">Chargement...</div>
          ) : (
            <div className="space-y-2">
              {devisesList.length === 0 && (
                <div className="text-gray-400 text-sm">Aucune devise définie</div>
              )}
              {devisesList.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3"
                >
                  <div>
                    <span className="font-mono font-semibold text-gray-900">{d.code}</span>
                    {d.libelle && (
                      <span className="ml-3 text-sm text-gray-500">{d.libelle}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingDev(d);
                        setDevForm({ code: d.code, libelle: d.libelle || '' });
                        setShowDevModal(true);
                      }}
                      className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      ✏️ Modifier
                    </button>
                    <button
                      onClick={() => handleDeleteDev(d.id, d.code)}
                      className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      🗑 Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {showDevModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">
                  {editingDev ? '✏️ Modifier' : '+ Ajouter'} une devise
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                    <input
                      type="text"
                      value={devForm.code}
                      onChange={(e) => setDevForm({ ...devForm, code: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono uppercase"
                      placeholder="TND, EUR, USD..."
                      maxLength={12}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Libellé</label>
                    <input
                      type="text"
                      value={devForm.libelle}
                      onChange={(e) => setDevForm({ ...devForm, libelle: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="Ex. Dinar tunisien"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setShowDevModal(false)}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSaveDev}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contenu Notifications */}
      {activeTab === 'notifications' && (
        <NotificationsTab />
      )}
    </div>
  );
}

