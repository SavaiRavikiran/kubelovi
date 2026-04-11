/**
 * Explorer API routes - K8s resource list endpoints (read-only).
 * All routes require requireExplorerAccess (username === 'explorer').
 */

function registerExplorerRoutes(app, { requireExplorerAccess, getK8sClient, ensureInitialized, getEnvironments }) {
  // Helper: send items from list response
  function sendList(res, response, mapItem = (item) => item) {
    const items = (response && response.body && response.body.items) ? response.body.items : [];
    res.json(items.map(mapItem));
  }

  // Cluster-scoped: Nodes
  app.get('/api/explorer/nodes/:environment', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const response = await client.coreApi.listNode();
      sendList(res, response, (node) => ({
        name: node.metadata.name,
        status: node.status?.conditions?.find(c => c.type === 'Ready')?.status || 'Unknown',
        age: node.metadata.creationTimestamp,
        roles: node.metadata.labels?.['node-role.kubernetes.io/master'] ? 'master' : 'worker',
      }));
    } catch (error) {
      console.error('Explorer nodes error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch nodes' });
    }
  });

  // Namespaced: Deployments
  app.get('/api/explorer/deployments/:environment/:namespace', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const response = await client.appsApi.listNamespacedDeployment(req.params.namespace);
      sendList(res, response, (d) => ({
        name: d.metadata.name,
        namespace: d.metadata.namespace,
        ready: `${d.status?.readyReplicas ?? 0}/${d.status?.replicas ?? 0}`,
        replicas: d.status?.replicas ?? 0,
        age: d.metadata.creationTimestamp,
      }));
    } catch (error) {
      console.error('Explorer deployments error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch deployments' });
    }
  });

  // DaemonSets
  app.get('/api/explorer/daemonsets/:environment/:namespace', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const response = await client.appsApi.listNamespacedDaemonSet(req.params.namespace);
      sendList(res, response, (d) => ({
        name: d.metadata.name,
        namespace: d.metadata.namespace,
        desired: d.status?.desiredNumberScheduled ?? 0,
        current: d.status?.currentNumberScheduled ?? 0,
        ready: d.status?.numberReady ?? 0,
        age: d.metadata.creationTimestamp,
      }));
    } catch (error) {
      console.error('Explorer daemonsets error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch daemonsets' });
    }
  });

  // StatefulSets
  app.get('/api/explorer/statefulsets/:environment/:namespace', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const response = await client.appsApi.listNamespacedStatefulSet(req.params.namespace);
      sendList(res, response, (s) => ({
        name: s.metadata.name,
        namespace: s.metadata.namespace,
        ready: `${s.status?.readyReplicas ?? 0}/${s.status?.replicas ?? 0}`,
        replicas: s.status?.replicas ?? 0,
        age: s.metadata.creationTimestamp,
      }));
    } catch (error) {
      console.error('Explorer statefulsets error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch statefulsets' });
    }
  });

  // ReplicaSets
  app.get('/api/explorer/replicasets/:environment/:namespace', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const response = await client.appsApi.listNamespacedReplicaSet(req.params.namespace);
      sendList(res, response, (r) => ({
        name: r.metadata.name,
        namespace: r.metadata.namespace,
        ready: `${r.status?.readyReplicas ?? 0}/${r.status?.replicas ?? 0}`,
        replicas: r.status?.replicas ?? 0,
        age: r.metadata.creationTimestamp,
      }));
    } catch (error) {
      console.error('Explorer replicasets error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch replicasets' });
    }
  });

  // ReplicationControllers
  app.get('/api/explorer/replicationcontrollers/:environment/:namespace', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const response = await client.coreApi.listNamespacedReplicationController(req.params.namespace);
      sendList(res, response, (r) => ({
        name: r.metadata.name,
        namespace: r.metadata.namespace,
        replicas: r.status?.replicas ?? 0,
        readyReplicas: r.status?.readyReplicas ?? 0,
        age: r.metadata.creationTimestamp,
      }));
    } catch (error) {
      console.error('Explorer replicationcontrollers error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch replicationcontrollers' });
    }
  });

  // Jobs
  app.get('/api/explorer/jobs/:environment/:namespace', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const response = await client.batchApi.listNamespacedJob(req.params.namespace);
      sendList(res, response, (j) => ({
        name: j.metadata.name,
        namespace: j.metadata.namespace,
        completions: `${j.status?.succeeded ?? 0}/${j.spec?.completions ?? 1}`,
        duration: j.status?.completionTime ? (new Date(j.status.completionTime) - new Date(j.status.startTime)) / 1000 : null,
        age: j.metadata.creationTimestamp,
      }));
    } catch (error) {
      console.error('Explorer jobs error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch jobs' });
    }
  });

  // CronJobs
  app.get('/api/explorer/cronjobs/:environment/:namespace', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const response = await client.batchApi.listNamespacedCronJob(req.params.namespace);
      sendList(res, response, (c) => ({
        name: c.metadata.name,
        namespace: c.metadata.namespace,
        schedule: c.spec?.schedule || '-',
        suspend: c.spec?.suspend ?? false,
        lastSchedule: c.status?.lastSuccessfulTime || c.status?.lastScheduleTime || null,
        age: c.metadata.creationTimestamp,
      }));
    } catch (error) {
      console.error('Explorer cronjobs error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch cronjobs' });
    }
  });

  // ConfigMaps
  app.get('/api/explorer/configmaps/:environment/:namespace', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const response = await client.coreApi.listNamespacedConfigMap(req.params.namespace);
      sendList(res, response, (c) => ({
        name: c.metadata.name,
        namespace: c.metadata.namespace,
        dataKeys: c.data ? Object.keys(c.data).length : 0,
        age: c.metadata.creationTimestamp,
      }));
    } catch (error) {
      console.error('Explorer configmaps error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch configmaps' });
    }
  });

  // Secrets
  app.get('/api/explorer/secrets/:environment/:namespace', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const response = await client.coreApi.listNamespacedSecret(req.params.namespace);
      sendList(res, response, (s) => ({
        name: s.metadata.name,
        namespace: s.metadata.namespace,
        type: s.type || 'Opaque',
        dataKeys: s.data ? Object.keys(s.data).length : 0,
        age: s.metadata.creationTimestamp,
      }));
    } catch (error) {
      console.error('Explorer secrets error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch secrets' });
    }
  });

  // Services
  app.get('/api/explorer/services/:environment/:namespace', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const response = await client.coreApi.listNamespacedService(req.params.namespace);
      sendList(res, response, (s) => ({
        name: s.metadata.name,
        namespace: s.metadata.namespace,
        type: s.spec?.type || 'ClusterIP',
        clusterIP: s.spec?.clusterIP || '-',
        ports: (s.spec?.ports || []).map(p => p.port).join(','),
        age: s.metadata.creationTimestamp,
      }));
    } catch (error) {
      console.error('Explorer services error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch services' });
    }
  });

  // Ingresses
  app.get('/api/explorer/ingresses/:environment/:namespace', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const response = await client.networkingApi.listNamespacedIngress(req.params.namespace);
      sendList(res, response, (i) => ({
        name: i.metadata.name,
        namespace: i.metadata.namespace,
        class: i.spec?.ingressClassName || i.metadata?.annotations?.['kubernetes.io/ingress.class'] || '-',
        hosts: (i.spec?.rules || []).map(r => r.host).filter(Boolean).join(', ') || '-',
        age: i.metadata.creationTimestamp,
      }));
    } catch (error) {
      console.error('Explorer ingresses error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch ingresses' });
    }
  });

  // NetworkPolicies
  app.get('/api/explorer/networkpolicies/:environment/:namespace', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const response = await client.networkingApi.listNamespacedNetworkPolicy(req.params.namespace);
      sendList(res, response, (n) => ({
        name: n.metadata.name,
        namespace: n.metadata.namespace,
        podSelector: n.spec?.podSelector ? JSON.stringify(n.spec.podSelector) : '-',
        policyTypes: (n.spec?.policyTypes || []).join(', ') || 'Ingress, Egress',
        age: n.metadata.creationTimestamp,
      }));
    } catch (error) {
      console.error('Explorer networkpolicies error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch networkpolicies' });
    }
  });

  // PersistentVolumes (cluster-scoped)
  app.get('/api/explorer/persistentvolumes/:environment', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const response = await client.coreApi.listPersistentVolume();
      sendList(res, response, (pv) => ({
        name: pv.metadata.name,
        capacity: pv.spec?.capacity?.storage || '-',
        status: pv.status?.phase || 'Unknown',
        claim: pv.spec?.claimRef ? `${pv.spec.claimRef.namespace}/${pv.spec.claimRef.name}` : '-',
        storageClass: pv.spec?.storageClassName || '-',
        age: pv.metadata.creationTimestamp,
      }));
    } catch (error) {
      console.error('Explorer persistentvolumes error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch persistentvolumes' });
    }
  });

  // PersistentVolumeClaims
  app.get('/api/explorer/persistentvolumeclaims/:environment/:namespace', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const response = await client.coreApi.listNamespacedPersistentVolumeClaim(req.params.namespace);
      sendList(res, response, (pvc) => ({
        name: pvc.metadata.name,
        namespace: pvc.metadata.namespace,
        status: pvc.status?.phase || 'Unknown',
        capacity: pvc.status?.capacity?.storage || '-',
        volume: pvc.spec?.volumeName || '-',
        storageClass: pvc.spec?.storageClassName || '-',
        age: pvc.metadata.creationTimestamp,
      }));
    } catch (error) {
      console.error('Explorer persistentvolumeclaims error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch persistentvolumeclaims' });
    }
  });

  // CustomResourceDefinitions (cluster-scoped)
  app.get('/api/explorer/customresourcedefinitions/:environment', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const response = await client.apiextensionsV1Api.listCustomResourceDefinition();
      sendList(res, response, (crd) => ({
        name: crd.metadata.name,
        group: crd.spec?.group || '',
        version: (crd.spec?.versions || [])[0]?.name || crd.spec?.version || '',
        scope: crd.spec?.scope || 'Namespaced',
        kind: crd.spec?.names?.kind || '',
        plural: crd.spec?.names?.plural || '',
        age: crd.metadata.creationTimestamp,
      }));
    } catch (error) {
      console.error('Explorer customresourcedefinitions error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch customresourcedefinitions' });
    }
  });

  // CustomResources (namespaced): list by group, version, plural, optional namespace
  app.get('/api/explorer/customresources/:environment/:group/:version/:plural', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const { group, version, plural } = req.params;
      const namespace = req.query.namespace; // optional; if missing, list cluster-scoped or all namespaces
      const groupDot = group.replace(/%2F/g, '/'); // allow group with / encoded as %2F
      if (namespace) {
        const response = await client.customObjectsApi.listNamespacedCustomObject(groupDot, version, namespace, plural);
        sendList(res, response, (item) => ({
          name: item.metadata?.name,
          namespace: item.metadata?.namespace,
          age: item.metadata?.creationTimestamp,
        }));
      } else {
        const response = await client.customObjectsApi.listClusterCustomObject(groupDot, version, plural);
        sendList(res, response, (item) => ({
          name: item.metadata?.name,
          namespace: item.metadata?.namespace,
          age: item.metadata?.creationTimestamp,
        }));
      }
    } catch (error) {
      console.error('Explorer customresources error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch custom resources' });
    }
  });

  // Explorer: list pods in namespace
  app.get('/api/explorer/pods/:environment/:namespace', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const response = await client.coreApi.listNamespacedPod(req.params.namespace);
      const pods = (response.body.items || []).map(pod => ({
        name: pod.metadata.name,
        status: pod.status?.phase || 'Unknown',
        ready: pod.status?.containerStatuses
          ? `${pod.status.containerStatuses.filter(c => c.ready).length}/${pod.status.containerStatuses.length}`
          : '0/0',
        restarts: pod.status?.containerStatuses?.reduce((s, c) => s + (c.restartCount || 0), 0) || 0,
        age: pod.metadata.creationTimestamp,
      }));
      res.json(pods);
    } catch (error) {
      console.error('Explorer pods error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch pods' });
    }
  });

  // Explorer: list containers in pod
  app.get('/api/explorer/containers/:environment/:namespace/:pod', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const response = await client.coreApi.readNamespacedPod(req.params.pod, req.params.namespace);
      const pod = response.body;
      const containers = (pod.spec?.containers || []).map(c => ({
        name: c.name,
        image: c.image,
        ready: pod.status?.containerStatuses?.find(s => s.name === c.name)?.ready ?? false,
        restartCount: pod.status?.containerStatuses?.find(s => s.name === c.name)?.restartCount ?? 0,
      }));
      res.json(containers);
    } catch (error) {
      console.error('Explorer containers error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch containers' });
    }
  });

  // Explorer: list namespaces (same as main app but with requireExplorerAccess for explorer user)
  app.get('/api/explorer/namespaces/:environment', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const response = await client.coreApi.listNamespace();
      const names = (response.body.items || []).map(ns => ns.metadata.name);
      res.json(names);
    } catch (error) {
      console.error('Explorer namespaces error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch namespaces' });
    }
  });

  // Explorer: list environments (contexts)
  app.get('/api/explorer/environments', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const envs = (typeof getEnvironments === 'function') ? getEnvironments() : [];
      res.json(Array.isArray(envs) ? envs : []);
    } catch (error) {
      console.error('Explorer environments error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch environments' });
    }
  });

  // Explorer: cluster observability summary (all clusters with metrics for table + summary bar)
  app.get('/api/explorer/clusters-summary', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const envs = (typeof getEnvironments === 'function') ? getEnvironments() : [];
      if (!Array.isArray(envs) || envs.length === 0) {
        return res.json([]);
      }
      const summaries = [];
      for (const envName of envs) {
        try {
          const client = await getK8sClient(envName);
          const [nodesRes, nsRes, podsRes, deploymentsRes, daemonsetsRes, statefulsetsRes, jobsRes, cronjobsRes] = await Promise.all([
            client.coreApi.listNode(),
            client.coreApi.listNamespace(),
            client.coreApi.listPodForAllNamespaces(),
            client.appsApi.listDeploymentForAllNamespaces(),
            client.appsApi.listDaemonSetForAllNamespaces(),
            client.appsApi.listStatefulSetForAllNamespaces(),
            client.batchApi.listJobForAllNamespaces(),
            client.batchApi.listCronJobForAllNamespaces(),
          ]);
          const nodes = nodesRes.body.items || [];
          const namespaces = nsRes.body.items || [];
          const pods = podsRes.body.items || [];
          const nodeNotReady = nodes.filter(n => n.status?.conditions?.find(c => c.type === 'Ready')?.status !== 'True').length;
          const podPending = pods.filter(p => (p.status?.phase || '') === 'Pending').length;
          const podFailed = pods.filter(p => (p.status?.phase || '') === 'Failed').length;
          const podRunning = pods.filter(p => (p.status?.phase || '') === 'Running').length;
          const workloadsWithRestarting = pods.filter(p => (p.status?.containerStatuses || []).some(c => (c.restartCount || 0) > 0)).length;
          const deployments = (deploymentsRes.body.items || []).length;
          const daemonsets = (daemonsetsRes.body.items || []).length;
          const statefulsets = (statefulsetsRes.body.items || []).length;
          const jobs = (jobsRes.body.items || []).length;
          const cronjobs = (cronjobsRes.body.items || []).length;
          const workloadCount = deployments + daemonsets + statefulsets + jobs + cronjobs;
          const healthAlerts = (nodeNotReady > 0 ? 1 : 0) + (podFailed > 0 ? 1 : 0) + (podPending > 5 ? 1 : 0);
          const workloadWarnings = Math.min(workloadsWithRestarting, 99);
          summaries.push({
            name: envName,
            cluster: envName,
            healthAlerts: healthAlerts,
            customAlerts: 0,
            nodes: nodes.length,
            nodeWarningSignals: nodeNotReady,
            namespaces: namespaces.length,
            workloadWarningSignals: workloadWarnings,
            workloads: workloadCount,
            pods: pods.length,
            podRunning,
            podPending,
            podFailed,
            cpuUsage: '-',
            memoryUsage: '-',
            kubernetesVersion: '-',
            clusterProvider: 'Kubernetes',
            lastUpdated: new Date().toISOString(),
            state: healthAlerts > 2 ? 'Unhealthy' : (healthAlerts > 0 || workloadWarnings > 0) ? 'Warning' : 'Healthy',
          });
        } catch (err) {
          console.error(`Explorer cluster summary error for ${envName}:`, err.message);
          summaries.push({
            name: envName,
            cluster: envName,
            healthAlerts: 0,
            customAlerts: 0,
            nodes: 0,
            nodeWarningSignals: 0,
            namespaces: 0,
            workloadWarningSignals: 0,
            workloads: 0,
            pods: 0,
            podRunning: 0,
            podPending: 0,
            podFailed: 0,
            cpuUsage: '-',
            memoryUsage: '-',
            kubernetesVersion: '-',
            clusterProvider: 'Kubernetes',
            lastUpdated: new Date().toISOString(),
            state: 'Unknown',
            error: err.message,
          });
        }
      }
      res.json(summaries);
    } catch (error) {
      console.error('Explorer clusters-summary error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch cluster summaries' });
    }
  });

  // Explorer: single cluster detail (for right-side panel)
  app.get('/api/explorer/cluster-detail/:environment', requireExplorerAccess, async (req, res) => {
    try {
      await ensureInitialized();
      const client = await getK8sClient(req.params.environment);
      const [nodesRes, nsRes, podsRes, deploymentsRes, daemonsetsRes, statefulsetsRes, jobsRes, cronjobsRes, servicesRes] = await Promise.all([
        client.coreApi.listNode(),
        client.coreApi.listNamespace(),
        client.coreApi.listPodForAllNamespaces(),
        client.appsApi.listDeploymentForAllNamespaces(),
        client.appsApi.listDaemonSetForAllNamespaces(),
        client.appsApi.listStatefulSetForAllNamespaces(),
        client.batchApi.listJobForAllNamespaces(),
        client.batchApi.listCronJobForAllNamespaces(),
        client.coreApi.listServiceForAllNamespaces(),
      ]);
      const nodes = nodesRes.body.items || [];
      const pods = podsRes.body.items || [];
      const nodeNotReady = nodes.filter(n => n.status?.conditions?.find(c => c.type === 'Ready')?.status !== 'True').length;
      const podPending = pods.filter(p => (p.status?.phase || '') === 'Pending').length;
      const podFailed = pods.filter(p => (p.status?.phase || '') === 'Failed').length;
      const podRunning = pods.filter(p => (p.status?.phase || '') === 'Running').length;
      const workloadsWithRestarting = pods.filter(p => (p.status?.containerStatuses || []).some(c => (c.restartCount || 0) > 0)).length;
      const deployments = deploymentsRes.body.items || [];
      const daemonsets = daemonsetsRes.body.items || [];
      const statefulsets = statefulsetsRes.body.items || [];
      const jobs = jobsRes.body.items || [];
      const cronjobs = cronjobsRes.body.items || [];
      const services = servicesRes.body.items || [];
      const workloadCount = deployments.length + daemonsets.length + statefulsets.length + jobs.length + cronjobs.length;
      const containerCount = pods.reduce((s, p) => s + (p.spec?.containers?.length || 0), 0);
      res.json({
        name: req.params.environment,
        nodes: nodes.length,
        namespaces: (nsRes.body.items || []).length,
        workloads: workloadCount,
        pods: pods.length,
        services: services.length,
        containers: containerCount,
        nodeNotReady,
        podPending,
        podFailed,
        podRunning,
        workloadsWithRestarting,
        state: nodeNotReady > 0 || podFailed > 0 ? (nodeNotReady > 2 ? 'Unhealthy' : 'Warning') : 'Healthy',
      });
    } catch (error) {
      console.error('Explorer cluster-detail error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch cluster detail' });
    }
  });
}

module.exports = registerExplorerRoutes;
