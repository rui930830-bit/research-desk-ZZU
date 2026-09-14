"""Fictional onboarding records. Never imported into an existing workspace automatically."""
from datetime import date, timedelta
from pathlib import Path
import copy

COLLECTIONS = ('tasks','projects','students','meetings','collaborators')

def make_demo(folder, day=None):
    day = day or date.today()
    d = lambda offset: (day + timedelta(days=offset)).isoformat()
    def record(id, title, **fields):
        return dict(id='demo-'+id, title='【示例】'+title, demo=True, archived=False, notes='虚拟教学示例，可自由编辑。开始正式使用前，可在设置中清除示例。', **fields)
    roots = {}
    for key in ('论文','申报','其他项目','学生','行政任务','期刊审稿','学生工作','协助评阅'):
        root = Path(folder)/key;root.mkdir(parents=True,exist_ok=True)
        (root/'阅读我.txt').write_text('这是研间的虚拟示例资料。可以浏览、用本机软件打开，也可以更换为自己的资料目录。\n',encoding='utf-8')
        (root/'任务清单.csv').write_text('事项,状态\n整理资料,完成\n撰写提纲,待办\n',encoding='utf-8-sig')
        (root/'参考材料').mkdir(exist_ok=True)
        (root/'参考材料'/'资料说明.md').write_text('# 虚拟资料\n这里演示子文件夹浏览。\n',encoding='utf-8')
        roots[key] = str(root.resolve())
    def stages(prefix, ongoing=False, complete=False):
        return [dict(id=prefix+'-'+str(i),title=title,weight=1,done=complete or i<2,start=d(-28+i*7),end='present' if ongoing and i==3 else d(-22+i*7)) for i,title in enumerate(['选题与设计','材料整理','分析与写作','投稿与返修'])]
    collaborators=[record('c1','林知远',institution='示例大学（虚构）',position='讲师',research='公共服务与数字治理',contact='虚拟档案，无真实联系方式'),record('c2','陈书宁',institution='示例研究院（虚构）',position='研究员',research='城乡发展',contact='虚拟档案')]
    students=[]
    for i,(name,kind) in enumerate([('周予安','博士生'),('许清禾','全日制研究生'),('宋明溪','MPA'),('陆星野','本科生')]):
        students.append(record('s'+str(i),name,kind=kind,topic='社区公共服务满意度研究（虚构）',graduation=d(180+i*30),followup=d(2+i),folder=roots['学生'],feedback='已根据建议整理提纲',guidance=[dict(id='demo-g'+str(i),date=d(0 if i==0 else -3),content='讨论研究问题、材料来源与论文结构。\n\n- [x] 明确研究对象\n- [ ] 完成文献矩阵',feedback='学生计划先梳理三类文献。',followup=d(3))]))
    projects=[record('p1','数字服务与社区参与',kind='学术论文',deadline=d(14),next='核对访谈提纲',pinned=True,folder=roots['论文'],studentIds=['demo-s0','demo-s1'],collaboratorIds=['demo-c1'],stages=stages('paper',True),targetJournal='《示例公共治理》（首选，虚构）；《示例社会研究》（备选，虚构）',submissions=[dict(id='demo-sub1',journal='示例社会研究（虚构）',submitted=d(-20),status='退稿',resultDate=d(-12),manuscriptNo='DEMO-001',notes='演示保留历史投稿记录'),dict(id='demo-sub2',journal='示例公共治理（虚构）',submitted=d(-7),status='外审中',resultDate='',manuscriptNo='DEMO-002',notes='转投新期刊后新增记录')]),record('p2','社区韧性课题申报',kind='项目申报',deadline=d(5),next='完善研究方法',pinned=False,folder=roots['申报'],studentIds=['demo-s0'],collaboratorIds=['demo-c2'],stages=[dict(id='grant-'+str(i),title=t,weight=1,done=i==0,start=d(-7+i*3),end=d(-4+i*3)) for i,t in enumerate(['申报准备','方案撰写','论证修改','材料提交'])]),record('p3','教学案例整理',kind='其他事项',deadline=d(-2),next='已完成案例交付',pinned=False,folder=roots['其他项目'],studentIds=[],collaboratorIds=[],stages=stages('other',complete=True))]
    meetings=[record('m1','全日制学生组会',group='全日制',date=d(3),completed=False,attendees='周予安、许清禾（虚构）',agenda='## 议题\n1. 论文进展\n2. 方法讨论\n3. 下阶段任务'),record('m2','MPA论文讨论',group='MPA',date=d(8),completed=False,attendees='宋明溪（虚构）',agenda='讨论开题提纲与案例选择'),record('m3','研究设计小组讨论',group='全日制',date=d(0),completed=True,attendees='虚拟研究小组',agenda='已完成讨论：明确研究对象与下一步资料整理。')]
    tasks=[]
    for i,(title,bucket,done,extra) in enumerate([
        ('整理文献矩阵','今天',False,dict(projectId='demo-p1',studentId='demo-s1')),
        ('临时补充会议材料','今天',False,dict(isTemporary=True)),
        ('准备组会汇报提纲','近期',False,dict(meetingId='demo-m1')),
        ('学习新的分析方法','以后',False,{}),
        ('核对研究问题','今天',True,dict(completedOn=d(0),projectId='demo-p1')),
        ('汇总课程材料','近期',False,dict(affairsType='行政任务',requester='示例教学办公室')),
        ('评阅社区治理稿件','今天',False,dict(affairsType='期刊审稿',reviewJournal='示例公共事务评论（虚构）',manuscriptTitle='社区协作机制研究（虚构）',reviewNumber='DEMO-R01',requester='示例编辑')),
        ('准备研究方法课程','近期',False,dict(affairsType='学生工作')),
        ('帮同事看申报书','近期',False,dict(affairsType='协助评阅',requester='【示例】求助人（虚构）',assistanceType='项目',manuscriptTitle='基层服务创新课题（虚构）')),
    ]):
        fields=dict(bucket=bucket,done=done,deadline=d(-1 if i==6 else 2+i),projectId='',studentId='',meetingId='',isTemporary=False);fields.update(extra)
        tasks.append(record('t'+str(i),title,**fields))
    return dict(version=2,revision=0,projects=projects,students=students,meetings=meetings,collaborators=collaborators,tasks=tasks,affairsFolders={k:roots[k] for k in ('行政任务','期刊审稿','学生工作','协助评阅')},demoFolderLinks={k:roots[k] for k in ('行政任务','期刊审稿','学生工作','协助评阅')})

def without_demo(data):
    result=copy.deepcopy(data)
    removed={k:{r['id'] for r in result[k] if r.get('demo') is True} for k in COLLECTIONS}
    for k in COLLECTIONS: result[k]=[r for r in result[k] if r.get('demo') is not True]
    for t in result['tasks']:
        for key,collection in [('projectId','projects'),('studentId','students'),('meetingId','meetings'),('requesterId','collaborators'),('ownerId','collaborators'),('initiatorId','collaborators')]:
            if t.get(key) in removed[collection]: t[key]=''
    for p in result['projects']:
        for key,collection in [('studentIds','students'),('collaboratorIds','collaborators')]:
            if key in p:p[key]=[id for id in p[key] if id not in removed[collection]]
    for k,path in result.pop('demoFolderLinks',{}).items():
        if result.get('affairsFolders',{}).get(k)==path:result['affairsFolders'].pop(k)
    return result
